---
name: frontend-architecture
description: World-class engineering standards for modern React and Next.js applications, Server/Client component boundaries, reactive state management, and Core Web Vitals optimization.
---

# Skill: Frontend Architecture & Client Performance Engineering

Governs client-side software architecture, component modularity, state flow, and performance standards across Exo Advance web applications.

## 1. Architectural Boundaries (RSC vs. Client Components)
- **Server-First Hierarchy:** Default all components to React Server Components (RSC) to minimize client JavaScript bundle size and eliminate client-side data waterfall latency.
- **Surgical Client Island Isolation:** Restrict the `'use client'` directive exclusively to leaves of the component tree requiring DOM events, browser APIs, or local state.

## 2. Minimalist Reactive State Management
- **Single Source of Truth:** Prefer URL search params, server-cached data, and server actions over deeply nested client state stores.
- **Ephemeral State Discipline:** Keep UI state (toggles, modals, forms) strictly local to the consuming component. Do not pollute global contexts with transient state.
- **Context Hell Prevention:** Avoid wrapping the entire application in monolithic contexts that trigger re-render cascades across unaffected subtrees.

## 3. Resilience & Core Web Vitals (CWV)
- **Optimistic UI with Graceful Rollbacks:** Implement instantaneous feedback on user actions (e.g., likes, checklist toggles) with automatic rollback and error notifications if the server action fails.
- **Aggressive CWV Optimization:**
  - **LCP (Largest Contentful Paint) < 1.2s:** Prioritize critical image preload and responsive image sizing (`sizes`, `srcset`).
  - **CLS (Cumulative Layout Shift) = 0:** Pre-reserve layout dimensions for async elements, skeletons, and media.
  - **INP (Interaction to Next Paint) < 100ms:** Offload heavy computations from the main thread; use transitions (`useTransition`) for non-urgent updates.
- **Error Boundaries & Suspense Skeletons:** Wrap async and failure-prone components in granular `ErrorBoundary` and `Suspense` boundaries to prevent blank screen crashes.

## 4. Vercel Deployment & Observability MCP Tooling
When `.mcp.json` is configured with the Vercel MCP server:
- **Build & Deployment Health Inspection:** Query deployment statuses and recent commit builds directly via MCP to diagnose build-time breakages or edge function errors.
- **Runtime Log Telemetry:** Fetch live serverless function logs and runtime exceptions to diagnose production bugs without manual dashboard navigation.
- **Environment Variable Synchronization:** Inspect non-sensitive project environment variables across environments (`preview`, `production`) to ensure build-time parity.