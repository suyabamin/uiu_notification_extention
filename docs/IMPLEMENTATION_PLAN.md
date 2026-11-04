# IMPLEMENTATION PLAN

Each phase ends with: `pnpm lint && pnpm typecheck && pnpm test` green + manual verification list. Do not start the next phase until the current one is accepted.

## Phase 0 — Project Setup
- [ ] Init repo with WXT + React + TS + Tailwind + ESLint + Prettier + Vitest + Husky (pre-commit lint).
- [ ] Configure Chrome and Edge builds (`pnpm build:chrome`, `pnpm build:edge`), zip scripts.
- [ ] Strict CSP in manifest; minimal permissions.
- [ ] Shared types, constants (`ALLOWED_HOSTS`), `isAllowedUrl()` + tests.
**Accept:** extension loads in Chrome and Edge, empty popup shows.

## Phase 1 — Core Infrastructure
- [ ] Typed storage layer with Zod + migrations.
- [ ] Logger (ring buffer, redaction).
- [ ] Messaging layer with validation.
- [ ] Scheduler (`chrome.alarms`, jitter, run on startup).
- [ ] Fetcher (rate limit, timeout, retry, backoff, host allow-list).
- [ ] Offscreen document + parser message channel.
**Accept:** "Check now" fetches a configured URL and returns parsed `<title>`; unit tests for fetcher/backoff.

## Phase 2 — Session Handling
- [ ] Session checker for ELMS and UCAM (using fixtures `login.html` + logged-in pages).
- [ ] Portal status model + login-required notification (once per 6 h).
**Accept:** logging out shows "Login required"; logging in flips to "Connected".

## Phase 3 — Diff Engine + Notification Manager
- [ ] `diff.ts` pure functions with exhaustive tests (added/modified/removed, baseline, removal guard, dedup).
- [ ] Notification manager: priority, grouping, quiet hours, snooze, badge, click-to-open, hide-details.
- [ ] Synthetic change generator for dev (Dashboard → Diagnostics "Simulate change").
**Accept:** simulated changes produce correct native notifications and badge.

## Phase 4 — ELMS Adapter
- [ ] Verify fixtures exist (ask user if missing).
- [ ] Parsers: course list, course content (materials/assignments/quizzes/forums/folders), announcements, forum discussions, assignments, grades, calendar, Moodle notifications.
- [ ] Course selection logic; stable IDs; hashing with normalization.
- [ ] Parser health checks and `PARSER_SUSPECT` handling.
**Accept:** fixture tests pass; with a real login, baseline builds silently; adding a new item in a mutated fixture triggers the right notification.

## Phase 5 — UCAM Adapter
- [ ] Verify fixtures + `NOTES.md` (ask user if missing).
- [ ] Parsers for notices/announcements, results, dues, routine as available.
- [ ] Generic Watched Page detector with text diff and volatile-content stripping.
**Accept:** fixture tests pass; watched page change shows text diff in dashboard.

## Phase 6 — Frontend: Design System + Popup
- [ ] Tokens, theme switch, i18n (en/bn), local fonts.
- [ ] Components library.
- [ ] Popup per `UI_UX_SPEC.md` (status pills, tabs, list, actions, states).
**Accept:** matches spec; keyboard-only usable; dark mode OK; Bangla renders correctly.

## Phase 7 — Frontend: Dashboard + Onboarding
- [ ] Notifications page with filters/search/detail drawer.
- [ ] Courses, Watched Pages, Settings, Diagnostics, About pages.
- [ ] Onboarding flow with live login detection and test notification.
**Accept:** all settings persist and take effect; export/import and clear data work.

## Phase 8 — Hardening
- [ ] Security checklist from `SECURITY.md` fully ticked.
- [ ] Bundle scan script (no `eval`, no unexpected URLs, permissions diff).
- [ ] Error-path tests (offline, 429, 500, timeout, login redirect mid-cycle).
- [ ] Memory/time budget check for 8+ courses.
- [ ] Accessibility audit (axe).
**Accept:** `pnpm audit` clean; E2E suite passes.

## Phase 9 — Packaging & Docs
- [ ] Icons (16/32/48/128), screenshots.
- [ ] `INSTALL.md` for sideloading in Chrome/Edge (Developer mode).
- [ ] Final README, CHANGELOG, privacy text.
- [ ] (Optional) Store listing assets.
**Accept:** fresh machine install works from the zip.

## Phase 10 (Optional, only if user requests)
- Mode B encrypted auto-login (see `SECURITY.md` §3).
- Telegram bot / phone push via a user-owned server.
- Visual element picker for Watched Pages.
- Moodle AJAX "updates since" optimization.
