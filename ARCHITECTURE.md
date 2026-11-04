# ARCHITECTURE

## 1. Tech Stack
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **WXT** (Vite-based, MV3) | One codebase builds Chrome and Edge |
| Language | TypeScript (strict) | Safety |
| UI | React 18 + Tailwind CSS + Radix UI primitives | Accessible, modern |
| State | Zustand (UI), `chrome.storage` (persistent) | Simple |
| Validation | Zod | Validate parsed data and stored settings |
| Testing | Vitest (unit), Playwright (E2E with mock portal server) | |
| Lint | ESLint, Prettier | |
| Package manager | pnpm | |

## 2. High-Level Design

```
┌──────────────────────────── Browser (Chrome / Edge) ────────────────────────────┐
│                                                                                   │
│  ┌────────────┐   messages   ┌───────────────────────────────┐                    │
│  │ Popup UI   │◄────────────►│  Background Service Worker    │                    │
│  └────────────┘              │  - Scheduler (chrome.alarms)  │                    │
│  ┌────────────┐              │  - Orchestrator               │                    │
│  │ Dashboard  │◄────────────►│  - Diff Engine                │                    │
│  │ / Options  │              │  - Notification Manager       │                    │
│  └────────────┘              │  - Storage Layer              │                    │
│                              └──────┬───────────────┬────────┘                    │
│                                     │ fetch (GET,   │ message                     │
│                                     │ cookies)      ▼                             │
│                                     │        ┌───────────────┐                    │
│                                     │        │ Offscreen Doc │ DOMParser +        │
│                                     │        │ (HTML parser) │ Adapters           │
│                                     ▼        └───────────────┘                    │
│                      ucam.uiu.ac.bd   elms.uiu.ac.bd                              │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Components

### 3.1 Scheduler
- `chrome.alarms.create("check", { periodInMinutes })`. Service workers sleep, so never use `setInterval`.
- On `onAlarm` → `Orchestrator.runCycle()`.
- Also run on browser startup and after install (baseline).
- Jitter: schedule next alarm with ±20% random offset.

### 3.2 Orchestrator
```
runCycle():
  for portal in enabledPortals (sequential):
     session = SessionChecker.check(portal)
     if session == LOGIN_REQUIRED: notifyOnce(); continue
     snapshotNew = adapter.collect()          # fetch + parse
     snapshotOld = storage.getSnapshot(portal)
     if no snapshotOld: storage.save(snapshotNew); continue  # baseline
     changes = DiffEngine.diff(snapshotOld, snapshotNew)
     storage.save(snapshotNew); storage.appendChanges(changes)
     NotificationManager.dispatch(changes)
  update badge; record run log
```
- Wrap each portal and each course in try/catch; one failure never stops the cycle.
- A mutex prevents overlapping cycles (store `runningSince` in `storage.session`).

### 3.3 Fetcher
- `fetch(url, { credentials: "include", redirect: "follow", cache: "no-store" })`.
- Validates final URL host is in allow-list.
- Rate limiter: 1–2 s between requests; max concurrency 1 per portal.
- Timeout 20 s (AbortController). Retry 2× with exponential backoff on network error/5xx. Stop on 429 and back off the portal for 1 hour.
- Returns `{ status, finalUrl, html }`.

### 3.4 Session Checker
- Heuristics per portal: final URL contains `/login` or `LogIn.aspx`, or the DOM contains the login form.
- ELMS also: absence of `logout` link / `sesskey` indicates logged-out.

### 3.5 Offscreen Parser
- MV3 service workers have no `DOMParser`. Create an offscreen document (`reason: DOM_PARSER`) that receives `{adapterId, pageType, html, url}` and returns typed JSON.
- HTML is never rendered or executed; only parsed (`DOMParser` does not run scripts).

### 3.6 Adapters (see `PORTAL_ADAPTERS.md`)
```ts
interface PortalAdapter {
  id: "elms" | "ucam";
  baseUrl: string;
  isLoggedIn(doc: Document, url: string): boolean;
  collect(ctx: AdapterContext): Promise<Snapshot>; // orchestrates fetch + parse
}
```
Individual parsers: `parseCourseList`, `parseCourseContent`, `parseAnnouncements`, `parseForum`, `parseGrades`, `parseCalendar`, `parseNotifications`, `parseUcamNotices`, `parseWatchedPage`.

### 3.7 Diff Engine
Pure function. Compares two `Snapshot`s by stable item IDs and content hashes → `Change[]` (`added`, `modified`, `removed`). Details in `DATA_MODEL.md`.

### 3.8 Notification Manager
- Applies rules: type toggles, quiet hours, snooze, priority, grouping.
- `chrome.notifications.create` with `type: "basic"` (or `list` for summaries). Notification ID encodes the change ID; `onClicked` opens the item URL and marks it read.
- Updates badge via `chrome.action.setBadgeText`.

### 3.9 Storage Layer
- `chrome.storage.local`: snapshots, change history (capped at 1000 items / 90 days), settings, logs.
- `chrome.storage.session`: runtime flags (mutex, last session warning time).
- Typed wrapper with Zod validation and schema versioning/migrations.
- Use `unlimitedStorage` is NOT needed; keep snapshots compact (store hashes, not full HTML).

## 4. Folder Structure
```
uiu-notifier/
├─ docs/                       # these files
├─ fixtures/                   # sanitized sample HTML (ELMS, UCAM)
├─ src/
│  ├─ entrypoints/
│  │  ├─ background.ts         # service worker
│  │  ├─ offscreen/            # parser host (html + ts)
│  │  ├─ popup/                # popup React app
│  │  ├─ dashboard/            # full page: notification center + settings
│  │  └─ onboarding/           # first-run page
│  ├─ core/
│  │  ├─ scheduler.ts
│  │  ├─ orchestrator.ts
│  │  ├─ fetcher.ts
│  │  ├─ session.ts
│  │  ├─ diff.ts
│  │  ├─ notifications.ts
│  │  ├─ storage.ts
│  │  └─ logger.ts
│  ├─ adapters/
│  │  ├─ types.ts
│  │  ├─ elms/ (index.ts, selectors.ts, parsers/*.ts)
│  │  └─ ucam/ (index.ts, selectors.ts, parsers/*.ts, watched-page.ts)
│  ├─ ui/
│  │  ├─ components/           # Button, Card, Badge, Toggle, EmptyState...
│  │  ├─ features/             # NotificationList, PortalStatus, CourseFilter...
│  │  ├─ hooks/ ├─ i18n/ (en.json, bn.json) └─ styles/
│  └─ shared/ (types.ts, constants.ts, messaging.ts, schemas.ts)
├─ tests/ (unit/, e2e/, mock-portal/)
├─ wxt.config.ts
└─ package.json
```

## 5. Messaging Contract (UI ↔ background)
Typed messages in `shared/messaging.ts`:
- `GET_STATE`, `CHECK_NOW`, `MARK_READ {id|all}`, `SNOOZE {until}`, `UPDATE_SETTINGS`, `CLEAR_DATA`, `GET_PORTAL_STATUS`, `ADD_WATCHED_PAGE`, `TEST_PARSER {portal}`.
- Validate every incoming message with Zod; accept only from the extension's own contexts (`sender.id === chrome.runtime.id`).

## 6. Manifest (target)
```json
{
  "manifest_version": 3,
  "name": "UIU Notifier",
  "permissions": ["alarms", "notifications", "storage", "offscreen"],
  "host_permissions": ["https://ucam.uiu.ac.bd/*", "https://elms.uiu.ac.bd/*"],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": { "default_popup": "popup.html" },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'"
  }
}
```
Use `optional_host_permissions` + runtime prompt for user-added watched pages on other hosts only if ever needed (default: not allowed).

## 7. Error Handling & Observability (local only)
- Ring-buffer log (last 200 entries) in storage, viewable in Dashboard → "Diagnostics". Logs contain no cookies, tokens, or personal data.
- "Parser health": each parser returns `{ ok, itemCount, warnings }`. If a previously non-empty page now parses to 0 items, flag `PARSER_SUSPECT` and show a warning rather than reporting everything as "removed".

## 8. Key Design Decisions
1. **Session-cookie reuse over stored passwords** → no secret to leak.
2. **Offscreen parsing** → proper DOM APIs without running page scripts.
3. **Baseline-first diffing** → no notification flood on first run.
4. **Hash-based change detection** → compact storage, detects silent edits.
5. **Pluggable adapters + fixtures** → portal changes fixed in one place.
