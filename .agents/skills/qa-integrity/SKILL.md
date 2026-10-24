---
name: qa-integrity
description: World-class quality assurance engineering, strict TypeScript type checking, AST static analysis, regression prevention, and automated QA Gate verification.
---

# Skill: QA Integrity & Static Verification Engineering

Governs automated quality control, strict type safety, invariant auditing, and zero-regression standards before concluding any task.

## 1. Strict TypeScript Enforcement & Type Safety
- **Zero-Tolerance for Compilation Errors:** All code changes must pass strict type-checking (`tsc --noEmit` or stack equivalent) with zero errors and zero warnings.
- **Strict Mode Compliance:** Prohibit `any` casting, untyped function arguments, or unvalidated type assertions (`as unknown as T`).
- **Exhaustive Type Narrowing:** Handle union types, optional properties, and nullability with exhaustive type guards (`switch (type)` or discriminated unions) to prevent runtime exceptions.

## 2. Invariant & Contract Protection
- **Pre-Flight Invariant Audit:** Verify that no modification violates the core rules in `.agents/memory/invariants.json` or architectural boundaries in `graph.json`.
- **Surgical Diff Integrity:** Audit git diffs to ensure only authorized, requested blocks were touched. Reject extraneous refactoring, cosmetic rewrites, or deleted comments.

## 3. Automated Single-Command Verification (QA Gate)
Before marking any deliverable as completed, execute the unified verification gate:
```bash
node .agents/bin/verify.js
```
The output must report:
1. `[PASS]` Memory & Invariant Integrity.
2. `[PASS]` InfoSec Secret Audit (zero credentials exposed).
3. `[PASS]` Static Type Compilation.
4. `[PASS]` AST Skeleton Synchronization.