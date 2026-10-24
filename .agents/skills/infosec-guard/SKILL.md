---
name: infosec-guard
description: World-class cybersecurity standards, OWASP Top 10 threat mitigation, zero-trust secrets management, defensive input sanitization, and PII protection.
---

# Skill: InfoSec Guardian & Application Security Engineering

Establishes mandatory defensive engineering standards to protect Exo Advance platforms and customer data against vulnerabilities, zero-day exploits, and data breaches.

## 1. OWASP Top 10 Active Mitigation
- **A01 Broken Access Control / IDOR:** Validate tenant isolation and user authorization on every single resource request (`/api/entity/:id`). Never trust client-supplied identity parameters.
- **A02 Cryptographic Failures:** Ensure all transit communication is enforced over TLS 1.3 (HTTPS/WSS). Protect data at rest with industry-standard encryption (AES-256).
- **A03 Injection (SQLi, XSS, Command Injection):**
  - Prohibit raw string concatenation in SQL queries, command executions, or shell commands.
  - Escape and sanitize all user-generated content before rendering to the DOM to eliminate Cross-Site Scripting (XSS).
- **A07 Identification & Authentication Failures:** Enforce secure session cookies (`HttpOnly`, `Secure`, `SameSite=Strict`), brute-force rate-limiting, and multi-factor authentication (MFA) resilience.

## 2. Zero-Trust Secrets Management
- **Zero Secrets in Client Bundles:** Never expose service role keys, database connection strings, or private API credentials in client-accessible code or environment variables (`NEXT_PUBLIC_*`).
- **Environment Isolation:** Ensure `.env*` files are strictly excluded via `.gitignore`. Verify runtime credentials via isolated server context.

## 3. Defense-in-Depth & Edge Validation
- **Schema Validation at the Boundary:** Validate and parse 100% of incoming payloads at the API boundary using schema validators (e.g., Zod, Valibot) before triggering business logic.
- **Strict Content Security Policy (CSP):** Restrict script execution, frame embedding (`X-Frame-Options: DENY`), and external resource loading to authenticated origins.