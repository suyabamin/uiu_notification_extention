# REQUIREMENTS

## 1. Goal
Notify the student quickly when anything new or changed appears in UCAM or ELMS, without having to open the portals repeatedly.

## 2. Functional Requirements

### 2.1 ELMS (Moodle) — detect
| ID | Change type | Details |
|----|-------------|---------|
| E1 | New course material | New file, folder, page, URL, book, or label in a course section |
| E2 | Changed material | File renamed, replaced, or modified (name, modified time, size changes) |
| E3 | New assignment | New assignment, quiz, or activity |
| E4 | Assignment changes | Due date changed, description changed |
| E5 | Announcements | New post in a course "Announcements" / News forum |
| E6 | Forum posts | New discussion or reply in any forum the user can see |
| E7 | Grades | New grade, changed grade, new feedback |
| E8 | Calendar / deadlines | New or changed upcoming events |
| E9 | Moodle notifications | New items in the user's Moodle notification list |
| E10 | Hidden → visible | Items that become visible after being hidden |

### 2.2 UCAM (ASP.NET) — detect
| ID | Change type | Details |
|----|-------------|---------|
| U1 | Notice board | New or changed notices / announcements |
| U2 | Results / grade sheet | New published result or grade change |
| U3 | Registration / advising | Registration open/close, new messages |
| U4 | Dues / payment | Changes in due amount or payment status |
| U5 | Class routine / exam schedule | Changes to routine or exam schedule |
| U6 | Other watched pages | User may add any UCAM page URL as a "watched page" (generic content-change detection) |

> The exact UCAM pages are determined in the Discovery step (`PORTAL_ADAPTERS.md`). The generic **Watched Page** feature (U6) is the safety net so nothing is missed.

### 2.3 Notifications
- N1: Desktop notification (title, short body, source icon, click opens the exact page).
- N2: Toolbar badge with unread count.
- N3: In-extension Notification Center with history, read/unread, filters, search.
- N4: Optional sound.
- N5: Grouping: if more than 5 changes in one run, show one summary notification.
- N6: Quiet hours (e.g., 11 PM – 7 AM): collect silently, show badge only.
- N7: Per-source and per-type toggles (e.g., mute forum posts for one course).
- N8: Priority levels: High (grades, deadlines, announcements), Normal (materials), Low (forum replies).
- N9: "Snooze" for 1 hour / until tomorrow.

### 2.4 Session handling
- S1: Detect session expiry (redirect to login page, login form present) and show a single "Please log in again" notification with a button that opens the login page. Do not repeat more than once per 6 hours.
- S2: Per-portal status indicator: Connected / Login required / Error / Paused.

### 2.5 Settings
- Check interval (10 / 15 / 30 / 60 min).
- Enable/disable each portal and each change type.
- Course selection (which ELMS courses to watch; default: all enrolled).
- Language: English / বাংলা.
- Theme: Light / Dark / System.
- Export / import settings (JSON, without sensitive data).
- "Clear all data" button.
- Manual "Check now" button.

## 3. Non-Functional Requirements
- **Security & privacy:** see `SECURITY.md` (mandatory).
- **Performance:** a full check cycle for ~8 courses ≤ 30 s; memory use small; no UI jank.
- **Reliability:** failures in one portal/course must not stop others. Retries with backoff.
- **Resilience:** parser health checks; a layout change shows "Parser may be outdated" instead of silently failing.
- **First-run behavior:** the first successful check builds a **baseline** silently (no flood of notifications).
- **Compatibility:** latest Chrome and Edge (Chromium, MV3).
- **Accessibility:** WCAG 2.1 AA, keyboard navigable.
- **Localization:** English and Bangla (Unicode, proper Bangla font fallback).
- **Offline:** UI works offline with stored history.

## 4. Out of Scope
- Mobile push (may be a future phase via Telegram bot; requires a server, not in v1).
- Auto-downloading files.
- Any write actions on the portals.
- Firefox/Safari.
