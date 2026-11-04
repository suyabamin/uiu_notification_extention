# DATA MODEL

## 1. Core Types (`shared/types.ts`)
```ts
type PortalId = "elms" | "ucam";

type ItemKind =
  | "material" | "assignment" | "quiz" | "announcement" | "forum_post"
  | "grade" | "event" | "portal_notification" | "notice"
  | "result" | "due" | "routine" | "watched_page";

interface Item {
  id: string;            // stable ID (see PORTAL_ADAPTERS.md)
  portal: PortalId;
  kind: ItemKind;
  courseId?: string;
  courseName?: string;
  title: string;
  url: string;           // validated, allow-listed
  summary?: string;      // short plain text (≤200 chars)
  visible?: boolean;
  dueAt?: string;        // ISO
  postedAt?: string;     // ISO
  hash: string;          // SHA-256 of normalized meaningful fields
}

interface Snapshot {
  portal: PortalId;
  takenAt: string;       // ISO
  parserVersion: string;
  items: Record<string, Item>;   // keyed by id
  health: { ok: boolean; warnings: string[] };
}

type ChangeType = "added" | "modified" | "removed";
type Priority = "high" | "normal" | "low";

interface Change {
  id: string;            // uuid
  itemId: string;
  type: ChangeType;
  kind: ItemKind;
  portal: PortalId;
  courseName?: string;
  title: string;
  url: string;
  priority: Priority;
  detectedAt: string;    // ISO
  read: boolean;
  details?: { field: string; from?: string; to?: string }[]; // e.g. dueAt changed
  textDiff?: { added: string[]; removed: string[] };          // watched pages
}

interface Settings {
  schemaVersion: number;
  intervalMinutes: 10 | 15 | 30 | 60;
  portals: Record<PortalId, { enabled: boolean }>;
  watchedCourses: "all" | string[];
  enabledKinds: Record<ItemKind, boolean>;
  mutedCourses: string[];
  quietHours: { enabled: boolean; start: string; end: string };  // "23:00"
  sound: boolean;
  hideDetailsInNotifications: boolean;   // default true for grades
  language: "en" | "bn";
  theme: "light" | "dark" | "system";
  snoozeUntil?: string;
  watchedPages: { id: string; url: string; selector?: string; label: string }[];
}

interface PortalStatus {
  portal: PortalId;
  state: "connected" | "login_required" | "error" | "paused" | "parser_suspect";
  lastCheckAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  backoffUntil?: string;
}
```

## 2. Storage Keys (`chrome.storage.local`)
| Key | Value |
|-----|-------|
| `settings` | `Settings` |
| `snapshot:elms`, `snapshot:ucam` | `Snapshot` |
| `changes` | `Change[]` (max 1000, max 90 days) |
| `status` | `Record<PortalId, PortalStatus>` |
| `logs` | ring buffer, 200 entries |
| `meta` | `{ schemaVersion, installedAt, baselineDone: Record<PortalId, boolean> }` |

`chrome.storage.session`: `cycleRunningSince`, `lastLoginWarningAt`, `unlockedCredentials` (only if Mode B).

## 3. Diff Rules
1. Compare by `id`.
2. `added`: id in new, not in old.
3. `modified`: same id, different `hash`; compute `details` for changed fields.
4. `removed`: id in old, not in new — **only report** when parser health is OK and the new snapshot has ≥ 50% of the old item count (guards against layout breaks).
5. Baseline: if no old snapshot → store only, emit no changes.
6. Hidden → visible transition on an item = `added` (priority high for materials).
7. Dedup: never emit the same `(itemId, hash)` twice.

## 4. Priority Mapping
| Kind | Priority |
|------|----------|
| grade, result, announcement, notice, due, assignment (added/due changed), event with deadline | high |
| material, quiz, portal_notification, routine, watched_page | normal |
| forum_post | low |

## 5. Notification Text Templates (i18n)
- `"{course}: New material — {title}"`
- `"{course}: Assignment due date changed — {title}"`
- `"{course}: New announcement — {title}"`
- `"{course}: New grade posted"` (value hidden by default)
- `"UCAM: New notice — {title}"`
- Summary: `"{n} new updates in ELMS and UCAM"`

## 6. Migrations
`schemaVersion` integer; `migrate(oldVersion → new)` functions in `storage.ts`, unit-tested.
