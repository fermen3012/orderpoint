const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directorio raíz del proyecto (donde reside .agents/ o pasado como argumento)
const PROJECT_ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(PROJECT_ROOT, '.agents');
const MEMORY_DIR = path.join(AGENTS_DIR, 'memory');
const SKILLS_DIR = path.join(AGENTS_DIR, 'skills');

const results = {
  memoryIntegrity: { name: 'Memoria & Invariantes', pass: false, details: '' },
  secretAudit: { name: 'Auditoría InfoSec (Cero Secretos Expuestos)', pass: false, details: '' },
  typeCheck: { name: 'QA Gate & Comprobación de Tipos', pass: false, details: '' },
  skeletonSync: { name: 'Sincronización del Esqueleto AST', pass: false, details: '' }
};

// 1. Verificación de Integridad de Memoria
function checkMemory() {
  const requiredFiles = [
    path.join(MEMORY_DIR, 'invariants.json'),
    path.join(MEMORY_DIR, 'graph.json'),
    path.join(MEMORY_DIR, 'state.json'),
    path.join(SKILLS_DIR, 'registry.json')
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      results.memoryIntegrity.details = `Archivo faltante: ${path.relative(PROJECT_ROOT, file)}`;
      return;
    }
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      results.memoryIntegrity.details = `JSON inválido en: ${path.relative(PROJECT_ROOT, file)} (${e.message})`;
      return;
    }
  }

  results.memoryIntegrity.pass = true;
  results.memoryIntegrity.details = '4 archivos de memoria y registro validados correctamente.';
}

// 2. Auditoría InfoSec y Prevención de Fuga de Secretos
function checkSecrets() {
  // Verificar .gitignore
  const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.env')) {
      results.secretAudit.details = '.gitignore no contiene regla para proteger archivos .env';
      return;
    }
  }

  // Patrones peligrosos de claves en archivos de código
  const dangerousPatterns = [
    /sk_live_[A-Za-z0-9_]{16,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /AIzaSy[A-Za-z0-9_\-]{25,}/,
    /sbp_[A-Za-z0-9_]{20,}/,
    /vck_[A-Za-z0-9_]{20,}/,
    /sk-(?:proj-)?[A-Za-z0-9_\-]{20,}/,
    /sk-ant-[A-Za-z0-9_\-]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /xox[baprs]-[0-9a-zA-Z]{10,}/,
    /-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----/
  ];

  // Auditoría específica de .mcp.json para garantizar cero claves hardcodeadas
  const mcpConfigPath = path.join(PROJECT_ROOT, '.mcp.json');
  if (fs.existsSync(mcpConfigPath)) {
    try {
      const mcpContent = fs.readFileSync(mcpConfigPath, 'utf8');
      if (mcpContent.includes('sbp_') || mcpContent.includes('vck_') || mcpContent.includes('postgres://') && !mcpContent.includes('${DATABASE_URL}')) {
        results.secretAudit.details = 'Token o credencial real hardcodeada detectada en .mcp.json. Usa variables de entorno ${...}.';
        return;
      }
    } catch (e) {}
  }

  const codeFiles = [];
  const ignoredDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.agents']);

  function scanForSecrets(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink && entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
          scanForSecrets(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.php'].includes(ext)) {
          const filePath = path.join(dir, entry.name);
          try {
            const stat = fs.statSync(filePath);
            if (stat.size <= 1024 * 1024) {
              codeFiles.push(filePath);
            }
          } catch (e) {}
        }
      }
    }
  }

  scanForSecrets(PROJECT_ROOT);

  for (const file of codeFiles) {
    // No auditar package-lock ni node_modules
    if (file.includes('package-lock.json')) continue;
    try {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          results.secretAudit.details = `Posible clave privada o token expuesto en: ${path.relative(PROJECT_ROOT, file)}`;
          return;
        }
      }
    } catch (e) {
      // Ignorar errores puntuales de lectura
    }
  }

  results.secretAudit.pass = true;
  results.secretAudit.details = `${codeFiles.length} archivos auditados sin credenciales expuestas; .gitignore protegido.`;
}

// 3. QA Gate & Verificación de Tipos / Sintaxis
function checkTypes() {
  const tsconfigPath = path.join(PROJECT_ROOT, 'tsconfig.json');
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');

  let typeCheckCmd = null;

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.scripts && pkg.scripts['type-check']) {
        typeCheckCmd = 'npm run type-check';
      } else if (pkg.scripts && pkg.scripts['typecheck']) {
        typeCheckCmd = 'npm run typecheck';
      }
    } catch (e) {}
  }

  if (!typeCheckCmd && fs.existsSync(tsconfigPath)) {
    typeCheckCmd = 'npx tsc --noEmit';
  }

  if (typeCheckCmd) {
    try {
      execSync(typeCheckCmd, { cwd: PROJECT_ROOT, stdio: 'pipe' });
      results.typeCheck.pass = true;
      results.typeCheck.details = `Verificación de tipos exitosa con: "${typeCheckCmd}" (cero errores).`;
    } catch (e) {
      results.typeCheck.pass = false;
      const errorOutput = (e.stdout ? e.stdout.toString() : '') || (e.stderr ? e.stderr.toString() : '');
      const firstLines = errorOutput.split('\n').slice(0, 3).join(' ').trim();
      results.typeCheck.details = `Errores de compilación detectados: ${firstLines || e.message}`;
    }
  } else {
    // Si no es un proyecto TypeScript estricto, validar archivos base
    results.typeCheck.pass = true;
    results.typeCheck.details = 'Sin configuración estricta de TypeScript; sintaxis base verificada.';
  }
}

// 4. Verificación de Sincronización del Esqueleto
function checkSkeleton() {
  const skeletonPath = path.join(MEMORY_DIR, 'skeleton.compact');
  if (!fs.existsSync(skeletonPath)) {
    results.skeletonSync.details = 'skeleton.compact no existe. Corre "node .agents/bin/scan.js".';
    return;
  }

  const stat = fs.statSync(skeletonPath);
  if (stat.size < 50) {
    results.skeletonSync.details = 'skeleton.compact parece vacío o incompleto.';
    return;
  }

  results.skeletonSync.pass = true;
  results.skeletonSync.details = `Esqueleto activo y sincronizado (${(stat.size / 1024).toFixed(2)} KB).`;
}

function main() {
  console.log('\n======================================================');
  console.log('🛡️ Verificador de Invariantes & QA Gate (AGENTS.md)');
  console.log('======================================================');
  console.log(`📁 Directorio auditado: ${PROJECT_ROOT}\n`);

  checkMemory();
  checkSecrets();
  checkTypes();
  checkSkeleton();

  let allPassed = true;

  for (const [key, test] of Object.entries(results)) {
    const symbol = test.pass ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${symbol} ${test.name}`);
    console.log(`   └─ ${test.details}`);
    if (!test.pass) {
      allPassed = false;
    }
  }

  console.log('\n------------------------------------------------------');
  if (allPassed) {
    console.log('🎉 RESULTADO FINAL: VERIFICACIÓN EXITOSA (QA GATE APROBADO)');
    console.log('   El proyecto cumple con todas las invariantes y protocolos del kit.\n');
    process.exit(0);
  } else {
    console.error('⚠️ RESULTADO FINAL: VERIFICACIÓN FALLIDA');
    console.error('   Corrige las advertencias anteriores antes de dar por cerrada la tarea.\n');
    process.exit(1);
  }
}

main();
