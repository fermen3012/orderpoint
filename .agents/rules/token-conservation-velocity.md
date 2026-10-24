# Invariant Rule: Token Conservation & High-Velocity Engineering Engine
> Exo Advance Software Engineering Standard

**Status:** UNBREAKABLE (Core Invariant)

To maximize development velocity, eliminate context saturation, and reduce token consumption by 70% to 90%, all agents must rigorously enforce this protocol:

## 1. AST Skeleton First (Zero Blind Scanning)
- Before opening or reading source code files, consult `.agents/memory/skeleton.compact`.
- Identify the exact target file and line number (`L{number}`) directly from the AST index.
- Never run blind multi-file directory scans or recursive searches if the signature is already indexed.

## 2. Bounded Surgical Reads (Token Economy)
- In files exceeding 60 lines of code, **always supply `StartLine` and `EndLine`** to read only the contiguous scope surrounding the target function, interface, or component.
- Dumping entire multi-hundred line files into the conversation context window is strictly prohibited.

## 3. Contiguous Block Edits (Zero File Regeneration)
- Apply all code modifications using targeted block replacements (`edit_file`).
- Never rewrite or regenerate complete files that already function.
- Preserve all existing imports, comments, and adjacent logic untouched.

## 4. Zero Redundant Code Echoing in Chat Output
- Once code changes are persisted to disk via tools (`edit_file` or `write_file`), **never duplicate or re-print the full code in the text response**.
- Provide only a concise technical summary and the affected file path.
- In rapid technical clarifications, employ the one-line micro-badge format (`> 🛡️ [Assigned: ...] | [Executor: ...] | [Action]`) to prevent unnecessary token overhead.

## 5. Unified QA Gate Execution
- Avoid issuing multiple disconnected terminal commands that flood context with verbose logs.
- Execute the unified verification inspector:
  ```bash
  node .agents/bin/verify.js
  ```
  It validates type-checking, secret prevention, and memory integrity in a single execution with minimal log output.

## 6. Scoped Subagent Delegation
- For exploratory codebase analysis or extensive refactor planning, invoke a subagent with a restricted prompt rather than pulling entire directories into the parent context.

## 7. Anti-Amnesia State Ledger (Session Continuity)
- Never start complex tasks without inspecting `.agents/memory/state.json` (~150 tokens) to retrieve historical milestones and recent architectural decisions.
- Never conclude tasks without recording milestone completion and new technical decisions in `.agents/memory/state.json`.
- This guarantees zero cognitive amnesia across sessions while saving tens of thousands of redundant analysis tokens.
