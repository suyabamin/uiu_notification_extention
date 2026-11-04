export type PortalId = 'elms' | 'ucam';

export type ItemKind =
  | 'material'
  | 'assignment'
  | 'quiz'
  | 'announcement'
  | 'forum_post'
  | 'grade'
  | 'event'
  | 'portal_notification'
  | 'notice'
  | 'result'
  | 'due'
  | 'routine'
  | 'watched_page';

export interface Item {
  id: string; // stable ID (e.g. elms:course:123:cm:456)
  portal: PortalId;
  kind: ItemKind;
  courseId?: string;
  courseName?: string;
  title: string;
  url: string; // validated, allow-listed
  summary?: string; // short plain text (<=200 chars)
  visible?: boolean;
  dueAt?: string; // ISO string
  postedAt?: string; // ISO string
  hash: string; // SHA-256 of normalized meaningful fields
}

export interface Snapshot {
  portal: PortalId;
  takenAt: string; // ISO string
  parserVersion: string;
  items: Record<string, Item>; // keyed by id
  health: {
    ok: boolean;
    warnings: string[];
  };
}

export type ChangeType = 'added' | 'modified' | 'removed';
export type Priority = 'high' | 'normal' | 'low';

export interface ChangeDetail {
  field: string;
  from?: string;
  to?: string;
}

export interface TextDiff {
  added: string[];
  removed: string[];
}

export interface Change {
  id: string; // uuid
  itemId: string;
  type: ChangeType;
  kind: ItemKind;
  portal: PortalId;
  courseName?: string;
  title: string;
  url: string;
  priority: Priority;
  detectedAt: string; // ISO string
  read: boolean;
  details?: ChangeDetail[]; // e.g. dueAt changed
  textDiff?: TextDiff; // watched pages line diff
}

export interface WatchedPageConfig {
  id: string;
  url: string;
  selector?: string;
  label: string;
}

export interface Settings {
  schemaVersion: number;
  intervalMinutes: 10 | 15 | 30 | 60;
  portals: Record<PortalId, { enabled: boolean }>;
  watchedCourses: 'all' | string[];
  enabledKinds: Record<ItemKind, boolean>;
  mutedCourses: string[];
  quietHours: {
    enabled: boolean;
    start: string; // e.g. "23:00"
    end: string; // e.g. "07:00"
  };
  sound: boolean;
  hideDetailsInNotifications: boolean; // default true
  language: 'en' | 'bn';
  theme: 'light' | 'dark' | 'system';
  snoozeUntil?: string; // ISO string
  watchedPages: WatchedPageConfig[];
}

export type PortalState = 'connected' | 'login_required' | 'error' | 'paused' | 'parser_suspect';

export interface PortalStatus {
  portal: PortalId;
  state: PortalState;
  lastCheckAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  backoffUntil?: string;
}

export interface LogEntry {
  timestamp: string; // ISO string
  level: 'info' | 'warn' | 'error';
  portal?: PortalId;
  message: string;
  context?: Record<string, unknown>;
}

export interface StorageMeta {
  schemaVersion: number;
  installedAt: string;
  baselineDone: Record<PortalId, boolean>;
}
