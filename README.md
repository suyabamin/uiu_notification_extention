# UIU Notifier — Browser Extension (Chrome & Edge)

A Manifest V3 browser extension that watches the student's own **UCAM** (`https://ucam.uiu.ac.bd`) and **ELMS** (`https://elms.uiu.ac.bd`) portals and sends notifications when anything new appears: study materials, assignments, announcements, forum posts, grades, notices, and other changes.

## Document Map (read in this order)

| # | File | Purpose |
|---|------|---------|
| 1 | `README.md` | Overview and how to use these docs with a coding agent |
| 2 | `AGENTS.md` | Rules and conventions the coding agent MUST follow |
| 3 | `REQUIREMENTS.md` | Functional and non-functional requirements |
| 4 | `ARCHITECTURE.md` | System design, modules, data flow, tech stack, folder structure |
| 5 | `SECURITY.md` | Threat model and security rules (mandatory) |
| 6 | `PORTAL_ADAPTERS.md` | How to read ELMS (Moodle) and UCAM (ASP.NET) pages |
| 7 | `UI_UX_SPEC.md` | Frontend: popup, dashboard, options, onboarding, design system |
| 8 | `DATA_MODEL.md` | Types, storage schema, diffing rules |
| 9 | `IMPLEMENTATION_PLAN.md` | Phased task list with acceptance criteria |
| 10 | `TESTING.md` | Test strategy and release checklist |

## Quick Summary

- **Stack:** TypeScript, React, Tailwind CSS, WXT (Vite-based extension framework), Zustand, Vitest, Playwright.
- **Targets:** Chrome and Edge (Chromium, Manifest V3). Firefox is out of scope.
- **Auth model:** Uses the user's **existing logged-in browser session** (cookies). The extension never stores the password by default.
- **Checks:** Periodic background polling with `chrome.alarms` (default 15 min, minimum 10 min).
- **Notifications:** Desktop notifications, toolbar badge, in-extension notification center, optional sound.
- **Privacy:** All data stays local. No external servers, no analytics, no remote code.

## How to Use With a Coding Agent

1. Create an empty repo and put this `docs/` folder inside it.
2. Give the agent this first prompt:

   > Read every file in `/docs` in the order listed in README.md. Start with `AGENTS.md`. Then implement the project phase by phase following `IMPLEMENTATION_PLAN.md`. Do not skip phases. After each phase, run the tests and tell me what to verify manually.

3. **Discovery step (important):** the agent cannot log in to the portals. The user must save sanitized sample HTML of the logged-in pages (see `PORTAL_ADAPTERS.md`, section "Discovery") into `fixtures/`. The agent writes parsers against these files.
4. Load the unpacked extension in `chrome://extensions` or `edge://extensions` (Developer mode) and test with a real login.

## Scope Notice

This is a personal tool for a student's own account. It only reads pages the student can already open. It must not bypass authentication, scrape other users' data, or poll aggressively.
