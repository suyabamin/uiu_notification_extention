# PORTAL ADAPTERS

> The coding agent cannot log in to the portals. Selectors below are **starting hypotheses** based on standard Moodle and ASP.NET WebForms behavior. They MUST be verified against real fixtures from the Discovery step. If a fixture is missing, stop and ask the user.

## 0. Discovery (user task, before coding parsers)

The user logs in and saves **sanitized** HTML into `fixtures/`:

For each page: open it → right click → Save as "Webpage, HTML only" (or DevTools → Elements → copy outerHTML of `<html>`) → **remove personal data** (name, ID, email, tokens, `sesskey`, `__VIEWSTATE`, `__EVENTVALIDATION` values) → save.

**ELMS fixtures**
- `elms/dashboard.html` (`/my/`)
- `elms/course-list.html` (`/my/courses.php`)
- `elms/course-view-1.html`, `course-view-2.html` (`/course/view.php?id=…`)
- `elms/announcements.html` (course news forum)
- `elms/forum-view.html`, `elms/discussion.html`
- `elms/assignment-index.html` (`/mod/assign/index.php?id=…`), `assignment-view.html`
- `elms/grades-overview.html` (`/grade/report/overview/index.php`), `grades-course.html` (`/grade/report/user/index.php?id=…`)
- `elms/calendar-upcoming.html` (`/calendar/view.php?view=upcoming`)
- `elms/notifications.html` (`/message/output/popup/notifications.php` or notification drawer HTML)
- `elms/login.html` (logged-out page)

**UCAM fixtures**
- `ucam/login.html`
- `ucam/home.html` (after login)
- `ucam/notice-board.html` (wherever notices/announcements appear)
- `ucam/result.html`, `ucam/registration.html`, `ucam/dues.html`, `ucam/routine.html` (if present)
- A short `ucam/NOTES.md` listing menu path → URL of each useful page.

## 1. ELMS Adapter (Moodle)

### 1.1 Session detection
- Logged out: final URL matches `/login/index.php`, or `form#login` exists, or no `a[href*="logout.php"]`.
- Logged in: presence of `a[href*="logout.php"]` / user menu.

### 1.2 Collection flow
```
1. GET /my/courses.php  → list of enrolled courses [{id, name, url}]
   (fallback: /my/ dashboard course list; or /lib/ajax/service.php if available — optional)
2. For each watched course (sequential, 1–2 s delay):
   a. GET /course/view.php?id=ID
        → sections → activities: {cmid, type (resource|assign|forum|quiz|folder|page|url|...), name, url, visible, section, availability text, modified hints}
   b. GET news forum (Announcements) → discussions: {id, title, author, time, url, replyCount}
   c. GET /mod/forum/index.php?id=ID → other forums (optional, per setting)
   d. GET /mod/assign/index.php?id=ID → assignments with due dates, submission status
   e. GET /grade/report/user/index.php?id=ID → grade items: {name, grade, range, feedback}
3. GET /calendar/view.php?view=upcoming → events {id, name, time, course}
4. GET Moodle notifications page → items {id, subject, time, url, read}
5. Return Snapshot.
```

### 1.3 Starting selector hypotheses (verify with fixtures)
| Data | Selector hint |
|------|---------------|
| Course cards | `[data-region="course-content"] a[href*="course/view.php?id="]`, `.coursename` |
| Sections | `li.section`, `[data-for="section"]` |
| Activities | `li.activity`, `[data-for="cmitem"]`; `data-id` = cmid |
| Activity type | class `modtype_resource`, `modtype_assign`, `modtype_forum`, `modtype_folder`... |
| Activity link/name | `.activityname a`, `.instancename` (strip hidden `.accesshide` text) |
| Hidden state | class `dimmed`, `.badge` with "Hidden from students" |
| Forum discussions | `table.forumheaderlist tr.discussion`, `[data-region="discussion-list"]`, links `discuss.php?d=` |
| Grades table | `table.user-grade` / `table.generaltable` rows with `th.column-itemname`, `td.column-grade` |
| Assignments table | `table.generaltable` rows containing `a[href*="mod/assign/view.php"]`, due column |
| Calendar events | `[data-region="event-item"]`, `.event` with `data-event-id` |

### 1.4 Stable IDs
- Activity: `elms:course:{courseId}:cm:{cmid}`
- Forum discussion: `elms:discussion:{d}`
- Grade item: `elms:course:{courseId}:grade:{normalizedName}`
- Calendar event: `elms:event:{eventId}`
- Notification: `elms:notif:{id}`

### 1.5 Change hashing
Hash fields that matter: `name`, `url`, `visible`, `dueDate`, `modifiedHint`, `size`, `description` (normalized text). Normalize whitespace, strip timestamps like "Updated 3 mins ago" and tokens (`sesskey`) before hashing to avoid false positives.

### 1.6 Optional enhancement
If Moodle web services/AJAX (`/lib/ajax/service.php?sesskey=…&info=core_course_get_updates_since`) works for the account, it gives precise "updates since" data. Treat as optional optimization; fall back to HTML parsing. Extract `sesskey` from the page in memory only; never store it.

## 2. UCAM Adapter (ASP.NET WebForms)

### 2.1 Characteristics
- Pages use `__VIEWSTATE`, `__EVENTVALIDATION`, postbacks. Many pages require POST to switch tabs/filters.
- **v1 is GET-only.** Prefer pages reachable by plain GET (home, notice board). If a needed view requires a postback, document it and defer; do not implement POST in v1 (see AGENTS.md rule 8) unless the user explicitly approves in a later phase.

### 2.2 Session detection
- Logged out: final URL contains `Security/LogIn.aspx`, or login form fields (`input[type=password]`) exist.
- Logged in: presence of a logout link / student name header (confirm from fixtures).

### 2.3 Collection
```
1. GET home page after login (known from fixtures) → notices/announcements widgets.
2. GET each configured UCAM page (notice board, result, dues, routine) → parse tables/lists.
3. For unknown pages: Watched Page generic mode (below).
```

### 2.4 Watched Page (generic detector) — safety net
User supplies a URL (must be on the allow-listed hosts) and optionally a CSS selector for the region to watch.
- Fetch → `DOMParser` → extract region text (or `<body>` minus nav/scripts/styles).
- Remove volatile content: `__VIEWSTATE`, `__EVENTVALIDATION`, hidden inputs, timestamps/clock widgets, CSRF tokens, scripts, styles.
- Normalize whitespace → compute SHA-256 → compare.
- On change: compute a **line-level text diff** (added / removed lines) and show it in the Notification Center.
- Provide a "pick element" helper in the Dashboard (user pastes selector; v2 may add a visual picker).

### 2.5 Stable IDs
- Notice: `ucam:notice:{hash(title+date)}` (or portal ID if exposed)
- Watched page: `ucam:watch:{urlHash}`
- Result row: `ucam:result:{semester}:{courseCode}`

## 3. Adapter Testing
- Each parser: `tests/unit/adapters/<portal>/<parser>.test.ts` loads fixtures and asserts exact extracted items.
- Mutation fixtures: copy a fixture, add/remove/modify one item, assert the diff output.
- Layout-break fixture: remove a key container, assert `PARSER_SUSPECT` warning (not mass "removed").

## 4. Parser Output Contract
```ts
type ParseResult<T> = { ok: boolean; items: T[]; warnings: string[]; parserVersion: string };
```
