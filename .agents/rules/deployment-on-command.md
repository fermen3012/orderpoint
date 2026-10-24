# Invariant Rule: Git Push & Vercel Deployment on Explicit Command Only
> Exo Advance Software Engineering Standard

**Status:** UNBREAKABLE (Core Invariant)

To guarantee 100% production stability and maintain strict human authorization over releases, all agents must adhere to the **Deployment on Command Protocol**:

## 1. Zero Autonomous Production Deploys
- The agent is **strictly prohibited** from executing `git push`, triggering production deployments on Vercel, or creating release tags autonomously.
- Code staging and pushes must happen **only and exclusively when the user gives an explicit direct command** (e.g., *"sube los cambios a git y despliega en Vercel"*, *"push to main and deploy"*, *"haz release"*).

## 2. Pre-Deployment Flight Check (Mandatory QA Gate)
Before executing any git push or deployment upon user command, the agent must execute:
```bash
node .agents/bin/verify.js
```
- **If QA Gate Fails (`FAIL`):** Immediately abort the push. Alert the user with the specific errors (TypeScript compilation, exposed credentials, or invariant violations) and resolve them first.
- **If QA Gate Passes (`PASS`):** Proceed to the release pipeline.

## 3. Atomic Release Execution Pipeline
Upon receiving the user's release command and passing the QA Gate:
1. **Audit Staged Diffs:** Inspect `git status` and ensure no unintended, temporary, or sensitive files are staged.
2. **Semantic Commit Message:** Generate a clear, structured conventional commit message (e.g., `feat: implement appointment booking flow`, `fix: resolve multi-tenant RLS query`).
3. **Push to Remote:** Execute `git push origin <branch>` via Git / GitHub MCP.
4. **Vercel Telemetry Monitoring:** Query the Vercel MCP server to monitor the triggered build status, verifying that the deployment transitions from `BUILDING` to `READY`.
5. **Human Notification:** Return the live deployment URL, commit SHA, and build verification status to the user.