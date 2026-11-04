# AGENTS.md — Rules for the Coding Agent

## Mission
Build the UIU Notifier extension exactly as described in `/docs`. Prefer small, tested, reviewable steps.

## Hard Rules (never break)
1. **Manifest V3 only.** No MV2 APIs, no persistent background pages.
2. **No remote code.** No CDN scripts, no `eval`, no `new Function`, no inline scripts. Strict CSP.
3. **No password storage** in the default flow. See `SECURITY.md`.
4. **No network requests** except to `ucam.uiu.ac.bd` and `elms.uiu.ac.bd`. No analytics, telemetry, or third-party fonts/images.
5. **Minimum permissions.** Only: `alarms`, `notifications`, `storage`, `offscreen`, `cookies` (only if needed for session detection), and the two `host_permissions`. Justify any addition in a PR note.
6. **Never log** cookies, tokens, `sesskey`, ViewState, student ID, or full page HTML to the console in production builds.
7. **Polling floor:** never poll more often than every 10 minutes. Add random jitter (±20%). Sequential requests with a 1–2 s delay between them. Respect HTTP 429/5xx with exponential backoff.
8. **Read-only.** The extension performs only GET requests. No form submissions, no clicking buttons programmatically (exception: optional auto-login, disabled by default, see `SECURITY.md`).
9. **Untrusted HTML.** Parse fetched HTML with `DOMParser` in an offscreen document. Never inject fetched HTML into extension UI with `innerHTML`/`dangerouslySetInnerHTML`. Render text only.

## Code Conventions
- TypeScript `strict: true`. No `any` without a comment.
- ESLint + Prettier. Conventional Commits.
- Pure functions for parsing and diffing (easy to unit test).
- Every parser has fixture-based tests.
- Each module has a single responsibility; follow folder structure in `ARCHITECTURE.md`.
- All user-visible strings go through an i18n layer (`en` and `bn`).

## Working Style
- Work phase by phase from `IMPLEMENTATION_PLAN.md`.
- After each phase: run `pnpm lint && pnpm typecheck && pnpm test`, then summarize changes and manual verification steps.
- If a portal's HTML is unknown, **stop and ask for a fixture** instead of guessing selectors.
- Make selectors configurable (`selectors.ts`) and add a "parser health check" so layout changes produce a visible warning, not silent failure.

## Definition of Done (per feature)
- Types defined, code implemented, unit tests pass.
- Works on Chrome and Edge.
- No new permissions without justification.
- Accessibility checked (keyboard, contrast, screen reader labels).
