import {
  Settings,
  Snapshot,
  Change,
  PortalId,
  PortalStatus,
  StorageMeta,
} from '@/shared/types';
import {
  settingsSchema,
  snapshotSchema,
  changeSchema,
  portalStatusSchema,
  storageMetaSchema,
} from '@/shared/schemas';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  DEFAULT_PORTAL_STATUSES,
  DEFAULT_STORAGE_META,
} from '@/shared/defaults';
import { SCHEDULER_CONFIG } from '@/shared/constants';

const STORAGE_KEYS = {
  SETTINGS: 'settings',
  SNAPSHOT_PREFIX: 'snapshot:',
  CHANGES: 'changes',
  STATUS: 'status',
  LOGS: 'logs',
  META: 'meta',
} as const;

const SESSION_KEYS = {
  CYCLE_RUNNING_SINCE: 'cycleRunningSince',
  LAST_LOGIN_WARNING: 'lastLoginWarningAt',
} as const;

export class StorageService {
  /**
   * Run schema migrations if needed.
   */
  async init(): Promise<void> {
    const meta = await this.getMeta();
    if (meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
      await this.runMigrations(meta.schemaVersion, CURRENT_SCHEMA_VERSION);
    }
  }

  private async runMigrations(fromVersion: number, toVersion: number): Promise<void> {
    // Migration framework: each step upgrades version by 1
    let current = fromVersion;
    while (current < toVersion) {
      if (current === 0) {
        // Migration from unversioned to version 1
        current = 1;
      } else {
        current++;
      }
    }
    await this.updateMeta({ schemaVersion: toVersion });
  }

  // --- Meta ---
  async getMeta(): Promise<StorageMeta> {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.META);
    const parsed = storageMetaSchema.safeParse(raw[STORAGE_KEYS.META]);
    if (parsed.success) {
      return parsed.data;
    }
    const defaultMeta: StorageMeta = {
      ...DEFAULT_STORAGE_META,
      installedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.META]: defaultMeta });
    return defaultMeta;
  }

  async updateMeta(partial: Partial<StorageMeta>): Promise<void> {
    const current = await this.getMeta();
    const updated: StorageMeta = {
      ...current,
      ...partial,
      baselineDone: {
        ...current.baselineDone,
        ...(partial.baselineDone || {}),
      },
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.META]: updated });
  }

  // --- Settings ---
  async getSettings(): Promise<Settings> {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const parsed = settingsSchema.safeParse(raw[STORAGE_KEYS.SETTINGS]);
    if (parsed.success) {
      return parsed.data as Settings;
    }
    // Fall back to default settings
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  }

  async saveSettings(partial: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const merged: Settings = {
      ...current,
      ...partial,
      portals: {
        ...current.portals,
        ...(partial.portals || {}),
      },
      enabledKinds: {
        ...current.enabledKinds,
        ...(partial.enabledKinds || {}),
      },
      quietHours: {
        ...current.quietHours,
        ...(partial.quietHours || {}),
      },
    };

    const validated = settingsSchema.parse(merged);
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: validated });
    return validated as Settings;
  }

  // --- Snapshots ---
  async getSnapshot(portal: PortalId): Promise<Snapshot | null> {
    const key = `${STORAGE_KEYS.SNAPSHOT_PREFIX}${portal}`;
    const raw = await chrome.storage.local.get(key);
    const data = raw[key];
    if (!data) return null;

    const parsed = snapshotSchema.safeParse(data);
    return parsed.success ? (parsed.data as Snapshot) : null;
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    const validated = snapshotSchema.parse(snapshot);
    const key = `${STORAGE_KEYS.SNAPSHOT_PREFIX}${snapshot.portal}`;
    await chrome.storage.local.set({ [key]: validated });
  }

  // --- Changes & History ---
  async getChanges(): Promise<Change[]> {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.CHANGES);
    const data = raw[STORAGE_KEYS.CHANGES];
    if (!Array.isArray(data)) return [];

    const valid: Change[] = [];
    for (const item of data) {
      const parsed = changeSchema.safeParse(item);
      if (parsed.success) {
        valid.push(parsed.data as Change);
      }
    }
    return valid;
  }

  async appendChanges(newChanges: Change[]): Promise<void> {
    if (newChanges.length === 0) return;

    const current = await this.getChanges();
    // Combine, with newest first
    const combined = [...newChanges, ...current];

    // Prune: max items (1000) and max age (90 days)
    const ninetyDaysAgo = new Date(
      Date.now() - SCHEDULER_CONFIG.HISTORY_MAX_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const filtered = combined
      .filter((c) => c.detectedAt >= ninetyDaysAgo)
      .slice(0, SCHEDULER_CONFIG.HISTORY_MAX_ITEMS);

    await chrome.storage.local.set({ [STORAGE_KEYS.CHANGES]: filtered });
  }

  async markChangeRead(id: string): Promise<void> {
    const current = await this.getChanges();
    const updated = current.map((c) => (c.id === id ? { ...c, read: true } : c));
    await chrome.storage.local.set({ [STORAGE_KEYS.CHANGES]: updated });
  }

  async markAllChangesRead(): Promise<void> {
    const current = await this.getChanges();
    const updated = current.map((c) => ({ ...c, read: true }));
    await chrome.storage.local.set({ [STORAGE_KEYS.CHANGES]: updated });
  }

  // --- Portal Status ---
  async getAllPortalStatuses(): Promise<Record<PortalId, PortalStatus>> {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.STATUS);
    const stored = raw[STORAGE_KEYS.STATUS] || {};

    const elmsParsed = portalStatusSchema.safeParse(stored.elms);
    const ucamParsed = portalStatusSchema.safeParse(stored.ucam);

    return {
      elms: elmsParsed.success ? (elmsParsed.data as PortalStatus) : DEFAULT_PORTAL_STATUSES.elms,
      ucam: ucamParsed.success ? (ucamParsed.data as PortalStatus) : DEFAULT_PORTAL_STATUSES.ucam,
    };
  }

  async getPortalStatus(portal: PortalId): Promise<PortalStatus> {
    const all = await this.getAllPortalStatuses();
    return all[portal];
  }

  async updatePortalStatus(portal: PortalId, update: Partial<PortalStatus>): Promise<void> {
    const all = await this.getAllPortalStatuses();
    const updated: PortalStatus = {
      ...all[portal],
      ...update,
      portal,
    };
    all[portal] = updated;
    await chrome.storage.local.set({ [STORAGE_KEYS.STATUS]: all });
  }

  // --- Clear Data ---
  async clearAllData(): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    // Re-initialize default settings and metadata
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.STATUS]: DEFAULT_PORTAL_STATUSES,
      [STORAGE_KEYS.META]: {
        ...DEFAULT_STORAGE_META,
        installedAt: new Date().toISOString(),
      },
      [STORAGE_KEYS.CHANGES]: [],
      [STORAGE_KEYS.LOGS]: [],
    });
  }

  async clearHistory(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.CHANGES]: [] });
  }

  // --- Cycle Mutex via chrome.storage.session ---
  async acquireCycleLock(): Promise<boolean> {
    const raw = await chrome.storage.session.get(SESSION_KEYS.CYCLE_RUNNING_SINCE);
    const runningSince = raw[SESSION_KEYS.CYCLE_RUNNING_SINCE];

    if (runningSince && typeof runningSince === 'number') {
      // If cycle has been running for > 2 minutes, consider it stale and allow takeover
      const isStale = Date.now() - runningSince > 120_000;
      if (!isStale) {
        return false;
      }
    }

    await chrome.storage.session.set({
      [SESSION_KEYS.CYCLE_RUNNING_SINCE]: Date.now(),
    });
    return true;
  }

  async releaseCycleLock(): Promise<void> {
    await chrome.storage.session.remove(SESSION_KEYS.CYCLE_RUNNING_SINCE);
  }

  async isCycleLocked(): Promise<boolean> {
    const raw = await chrome.storage.session.get(SESSION_KEYS.CYCLE_RUNNING_SINCE);
    const runningSince = raw[SESSION_KEYS.CYCLE_RUNNING_SINCE];
    if (!runningSince || typeof runningSince !== 'number') return false;
    return Date.now() - runningSince <= 120_000;
  }

  // --- Session Warning Rate Limit ---
  async canShowSessionWarning(portal: PortalId): Promise<boolean> {
    const raw = await chrome.storage.session.get(SESSION_KEYS.LAST_LOGIN_WARNING);
    const map = (raw[SESSION_KEYS.LAST_LOGIN_WARNING] || {}) as Record<string, number>;
    const lastWarned = map[portal];
    if (!lastWarned) return true;
    return Date.now() - lastWarned >= SCHEDULER_CONFIG.SESSION_WARNING_INTERVAL_MS;
  }

  async recordSessionWarning(portal: PortalId): Promise<void> {
    const raw = await chrome.storage.session.get(SESSION_KEYS.LAST_LOGIN_WARNING);
    const map = (raw[SESSION_KEYS.LAST_LOGIN_WARNING] || {}) as Record<string, number>;
    map[portal] = Date.now();
    await chrome.storage.session.set({ [SESSION_KEYS.LAST_LOGIN_WARNING]: map });
  }
}

export const storage = new StorageService();
