const fs = require('fs');
const path = require('path');

// Directorio raíz a escanear (por defecto la raíz del proyecto donde reside .agents/)
const PROJECT_ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(PROJECT_ROOT, '.agents');
const MEMORY_DIR = path.join(AGENTS_DIR, 'memory');
const OUTPUT_FILE = path.join(MEMORY_DIR, 'skeleton.compact');

// Carpetas ignoradas para máxima velocidad y evitar gasto de tokens
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'out',
  '.agents',
  'coverage',
  '.vscode',
  '.idea',
  'tmp',
  'temp',
  'vendor'
]);

// Archivos vetados por seguridad (InfoSec Guard: Cero exposición de secretos)
const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /\.cert$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /secret/i,
  /credential/i,
  /service[-_]?account/i,
  /auth\.json$/i
];

// Extensiones de código soportadas
const SUPPORTED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.php', '.sql', '.go', '.rs'
]);

function isSensitiveFile(filename) {
  return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(filename));
}

// Límite máximo de tamaño de archivo para escaneo AST (1 MB) para mitigar DoS
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

// Sanitizador de secretos para evitar fugas en skeleton.compact
function sanitizeSecretLine(line) {
  let sanitized = line;

  // 1. Patrones conocidos de API keys y tokens
  sanitized = sanitized.replace(/sk_live_[A-Za-z0-9_]{16,}/g, '[REDACTED_SECRET_KEY]');
  sanitized = sanitized.replace(/rk_live_[A-Za-z0-9_]{16,}/g, '[REDACTED_SECRET_KEY]');
  sanitized = sanitized.replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, '[REDACTED_GITHUB_TOKEN]');
  sanitized = sanitized.replace(/AIzaSy[A-Za-z0-9_\-]{25,}/g, '[REDACTED_GOOGLE_KEY]');
  sanitized = sanitized.replace(/sk-proj-[A-Za-z0-9_\-]{20,}/g, '[REDACTED_OPENAI_KEY]');
  sanitized = sanitized.replace(/sk-ant-[A-Za-z0-9_\-]{20,}/g, '[REDACTED_ANTHROPIC_KEY]');
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]');
  sanitized = sanitized.replace(/xox[baprs]-[0-9a-zA-Z]{10,}/g, '[REDACTED_SLACK_TOKEN]');
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
  sanitized = sanitized.replace(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');

  // 2. Asignaciones a variables con nombres sensibles
  sanitized = sanitized.replace(/(password|secret|apikey|api_key|privatekey|private_key|token|access_token|db_pass)\s*[:=]\s*["'][^"']{6,}["']/gi, '$1 = "[REDACTED_SECRET]"');

  return sanitized;
}

function getRelativePath(fullPath) {
  return path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
}

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Ignorar symlinks para mitigar bucles cíclicos (CWE-400)
    if (entry.isSymbolicLink && entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        scanDirectory(path.join(dir, entry.name), fileList);
      }
    } else if (entry.isFile()) {
      if (isSensitiveFile(entry.name)) {
        continue; // Ignorar archivos sensibles por protección de InfoSec
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) {
        const fullFilePath = path.join(dir, entry.name);
        try {
          const stat = fs.statSync(fullFilePath);
          if (stat.size <= MAX_FILE_SIZE_BYTES) {
            fileList.push(fullFilePath);
          }
        } catch (e) {}
      }
    }
  }
  return fileList;
}

function extractSignatures(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const signatures = [];

  const patterns = [
    // Export functions / components
    { regex: /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*(\([^)]*\))/ },
    // Export const arrow functions o componentes React
    { regex: /^export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=>]+)?\s*=>/ },
    // Interfaces TypeScript
    { regex: /^export\s+interface\s+([A-Za-z0-9_]+)(?:\s+extends\s+[^{]+)?/ },
    // Types TypeScript
    { regex: /^export\s+type\s+([A-Za-z0-9_]+)\s*=/ },
    // Clases
    { regex: /^(?:export\s+(?:default\s+)?)?class\s+([A-Za-z0-9_]+)/ },
    // Next.js App Router route handlers
    { regex: /^export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(/ },
    // Python def / class
    { regex: /^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\):/ },
    { regex: /^class\s+([A-Za-z0-9_]+)(?:\([^)]*\))?:/ }
  ];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    for (const { regex } of patterns) {
      if (regex.test(trimmed)) {
        // Limpiar la firma para mantenerla ultra-compacta
        let sig = trimmed
          .replace(/\s*\{\s*$/, '')
          .replace(/;$/, '')
          .replace(/\s+/g, ' ');
        if (sig.length > 110) {
          sig = sig.substring(0, 107) + '...';
        }
        sig = sanitizeSecretLine(sig);
        signatures.push(`  L${i + 1}: ${sig}`);
        break;
      }
    }
  }

  return signatures;
}

function main() {
  console.log('🔍 Escaneando proyecto para generar esqueleto de firmas (AST Skeleton)...');
  console.log(`📁 Directorio raíz: ${PROJECT_ROOT}`);

  const files = scanDirectory(PROJECT_ROOT);
  let totalSignatures = 0;
  let filesWithSignatures = 0;

  const outputSections = [
    `# SKELETON MAP (Auto-Generated by .agents/bin/scan.js)`,
    `# Root: ${path.basename(PROJECT_ROOT)} | Generated: ${new Date().toISOString()}`,
    `# Uso: Consulta las firmas y lineas exactas aqui para evitar lecturas masivas de archivos.\n`
  ];

  for (const file of files) {
    const relPath = getRelativePath(file);
    const sigs = extractSignatures(file);
    if (sigs.length > 0) {
      filesWithSignatures++;
      totalSignatures += sigs.length;
      outputSections.push(`[${relPath}]`);
      outputSections.push(sigs.join('\n'));
      outputSections.push('');
    }
  }

  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, outputSections.join('\n'), 'utf8');

  const stats = fs.statSync(OUTPUT_FILE);
  const kbSize = (stats.size / 1024).toFixed(2);

  console.log('✅ Esqueleto generado con éxito:');
  console.log(`   📄 Archivo: ${getRelativePath(OUTPUT_FILE)}`);
  console.log(`   📦 Tamaño: ${kbSize} KB`);
  console.log(`   📁 Archivos indexados: ${filesWithSignatures} / ${files.length}`);
  console.log(`   ⚡ Firmas y tipos detectados: ${totalSignatures}\n`);
}

main();
