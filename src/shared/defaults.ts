import { Settings, PortalStatus, StorageMeta } from './types';

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  intervalMinutes: 15,
  portals: {
    elms: { enabled: true },
    ucam: { enabled: true },
  },
  watchedCourses: 'all',
  enabledKinds: {
    material: true,
    assignment: true,
    quiz: true,
    announcement: true,
    forum_post: true,
    grade: true,
    event: true,
    portal_notification: true,
    notice: true,
    result: true,
    due: true,
    routine: true,
    watched_page: true,
  },
  mutedCourses: [],
  quietHours: {
    enabled: false,
    start: '23:00',
    end: '07:00',
  },
  sound: false,
  hideDetailsInNotifications: true,
  language: 'en',
  theme: 'system',
  watchedPages: [],
};

export const DEFAULT_PORTAL_STATUSES: Record<'elms' | 'ucam', PortalStatus> = {
  elms: {
    portal: 'elms',
    state: 'connected',
  },
  ucam: {
    portal: 'ucam',
    state: 'connected',
  },
};

export const DEFAULT_STORAGE_META: StorageMeta = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  installedAt: new Date().toISOString(),
  baselineDone: {
    elms: false,
    ucam: false,
  },
};
