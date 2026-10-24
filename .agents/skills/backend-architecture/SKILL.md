---
name: backend-architecture
description: World-class engineering standards for scalable multi-tenant SaaS backends, database schema design, ACID transactions, data isolation, and API resilience.
---

# Skill: Backend Architecture & Distributed SaaS Systems

Governs technical standards for server-side logic, database reliability, performance optimization, and API integrity across Exo Advance software platforms.

## 1. Multi-Tenant Data Isolation & Security
- **Strict Row-Level Security (RLS):** Every query and mutation targeting tenant data must enforce tenant-scoping (`tenant_id = auth.uid()` or validated session context) at both the database and ORM layers.
- **Zero Cross-Tenant Leakage:** Prevent IDOR (Insecure Direct Object Reference) by validating ownership before executing reads, updates, or deletes.

## 2. Transaction Integrity & Concurrency
- **ACID Atomic Transactions:** Wrap interdependent data mutations inside atomic transactions to eliminate orphaned records and state corruption.
- **Idempotency by Design:** Implement strict idempotency keys (`idempotency_key`) for billing, Stripe charges, webhooks, and critical state transitions to prevent duplicate processing under network retries.
- **Optimistic Concurrency Control:** Utilize versioning columns or timestamps for high-contention resources to handle concurrent writes gracefully without deadlocks.

## 3. Query Optimization & Schema Architecture
- **Eliminate N+1 Queries:** Enforce eager loading, relational joins, or dataloaders for related entities.
- **Defensive Query Execution:** Use parameterized queries and prepared statements exclusively to prevent SQL injection.
- **Zero-Downtime Database Migrations:** Design schema changes with backward-compatible transitions (expand-contract pattern) to ensure continuous availability.

## 4. Error Handling & Observability (RFC 7807)
- **Standardized Error Contracts:** Return structured machine-readable error responses adhering to RFC 7807 (Problem Details: `type`, `title`, `status`, `detail`, `code`).
- **Telemetry Sanitization:** Never leak internal stack traces, database schema details, or environment secrets to client-facing error payloads.

## 5. Supabase & PostgreSQL MCP Tooling
When `.mcp.json` is configured with Supabase and Postgres MCP servers:
- **Direct Schema Inspection:** Use the MCP tools to inspect foreign keys, constraints, and column types before proposing migrations or drafting API payloads.
- **RLS Policy Auditing:** Query active PostgreSQL policies (`pg_policies`) via MCP to ensure zero security regressions on tenant tables.
- **Safe Read-Only Prototyping:** Run parameterized `SELECT` queries to verify real-time data shapes without leaving the agent workflow. Write operations must still be committed through tracked migration files.