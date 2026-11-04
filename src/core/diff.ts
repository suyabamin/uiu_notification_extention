import {
  Snapshot,
  Change,
  Priority,
  ChangeDetail,
  ItemKind,
  PortalId,
} from '@/shared/types';
import { SCHEDULER_CONFIG } from '@/shared/constants';

/**
 * Normalizes text for comparison by trimming, collapsing whitespace,
 * and stripping volatile strings like relative timestamps and tokens.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/sesskey=[a-zA-Z0-9_-]+/gi, '')
    .replace(/\b\d+\s+(second|minute|hour|day|week|month|year)s?\s+ago\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a stable SHA-256 hash from a string using Web Crypto API.
 */
export async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes a deterministic content hash for an item based on its meaningful fields.
 */
export async function computeItemHash(fields: {
  title: string;
  url: string;
  visible?: boolean;
  dueAt?: string;
  postedAt?: string;
  summary?: string;
}): Promise<string> {
  const normalized = [
    normalizeText(fields.title),
    fields.url.trim(),
    fields.visible === undefined ? 'default' : String(fields.visible),
    fields.dueAt || '',
    fields.postedAt || '',
    normalizeText(fields.summary || ''),
  ].join('|');

  return sha256(normalized);
}

/**
 * Maps an item kind and change context to a priority level.
 */
export function getChangePriority(kind: ItemKind, isHiddenToVisible = false): Priority {
  if (isHiddenToVisible) {
    return 'high';
  }

  switch (kind) {
    case 'grade':
    case 'result':
    case 'announcement':
    case 'notice':
    case 'due':
    case 'assignment':
      return 'high';
    case 'material':
    case 'quiz':
    case 'event':
    case 'portal_notification':
    case 'routine':
    case 'watched_page':
      return 'normal';
    case 'forum_post':
      return 'low';
    default:
      return 'normal';
  }
}

export interface DiffResult {
  changes: Change[];
  isParserSuspect: boolean;
  warnings: string[];
}

/**
 * Compares old and new snapshots to detect added, modified, and removed items.
 *
 * Rules:
 * 1. If oldSnapshot is null (first run), emit no changes (silent baseline).
 * 2. If new snapshot item count drops by >= 50% compared to old, flag PARSER_SUSPECT
 *    and suppress mass removals.
 * 3. Detects added, modified (with diff details), and removed items.
 * 4. Hidden -> visible transition is treated as an added item with high priority.
 */
export function diffSnapshots(
  oldSnapshot: Snapshot | null,
  newSnapshot: Snapshot
): DiffResult {
  const warnings: string[] = [];

  // Rule 1: Baseline run
  if (!oldSnapshot || Object.keys(oldSnapshot.items).length === 0) {
    return {
      changes: [],
      isParserSuspect: false,
      warnings: ['Baseline scan completed silently.'],
    };
  }

  const oldItems = oldSnapshot.items;
  const newItems = newSnapshot.items;
  const oldCount = Object.keys(oldItems).length;
  const newCount = Object.keys(newItems).length;

  // Rule 2: Removal guard / layout break detection
  // If count drops below 50% of old items and items are missing, flag PARSER_SUSPECT
  const ratio = oldCount > 0 ? newCount / oldCount : 1;
  const isSuspect =
    oldCount >= 4 && ratio < SCHEDULER_CONFIG.LAYOUT_BREAK_THRESHOLD_RATIO;

  if (isSuspect) {
    warnings.push(
      `Parser suspect for ${newSnapshot.portal}: item count dropped from ${oldCount} to ${newCount} (ratio ${ratio.toFixed(2)}). Suppressing removal notifications.`
    );
  }

  const changes: Change[] = [];
  const now = new Date().toISOString();

  // Check new items for added or modified
  for (const [id, newItem] of Object.entries(newItems)) {
    const oldItem = oldItems[id];

    if (!oldItem) {
      // New item added
      changes.push({
        id: crypto.randomUUID(),
        itemId: id,
        type: 'added',
        kind: newItem.kind,
        portal: newItem.portal,
        courseName: newItem.courseName,
        title: newItem.title,
        url: newItem.url,
        priority: getChangePriority(newItem.kind),
        detectedAt: now,
        read: false,
      });
      continue;
    }

    // Check hidden -> visible transition
    const becameVisible = oldItem.visible === false && newItem.visible === true;

    // Check modification
    if (oldItem.hash !== newItem.hash || becameVisible) {
      const details: ChangeDetail[] = [];

      if (oldItem.title !== newItem.title) {
        details.push({ field: 'title', from: oldItem.title, to: newItem.title });
      }
      if (oldItem.dueAt !== newItem.dueAt) {
        details.push({ field: 'dueAt', from: oldItem.dueAt, to: newItem.dueAt });
      }
      if (oldItem.visible !== newItem.visible) {
        details.push({
          field: 'visible',
          from: String(oldItem.visible),
          to: String(newItem.visible),
        });
      }
      if (oldItem.summary !== newItem.summary) {
        details.push({ field: 'summary', from: oldItem.summary, to: newItem.summary });
      }

      changes.push({
        id: crypto.randomUUID(),
        itemId: id,
        type: becameVisible ? 'added' : 'modified',
        kind: newItem.kind,
        portal: newItem.portal,
        courseName: newItem.courseName,
        title: newItem.title,
        url: newItem.url,
        priority: getChangePriority(newItem.kind, becameVisible),
        detectedAt: now,
        read: false,
        details: details.length > 0 ? details : undefined,
      });
    }
  }

  // Check old items for removals (unless suspect)
  if (!isSuspect && newSnapshot.health.ok) {
    for (const [id, oldItem] of Object.entries(oldItems)) {
      if (!newItems[id]) {
        changes.push({
          id: crypto.randomUUID(),
          itemId: id,
          type: 'removed',
          kind: oldItem.kind,
          portal: oldItem.portal,
          courseName: oldItem.courseName,
          title: oldItem.title,
          url: oldItem.url,
          priority: 'low',
          detectedAt: now,
          read: false,
        });
      }
    }
  }

  return {
    changes,
    isParserSuspect: isSuspect,
    warnings,
  };
}

/**
 * Generates a synthetic change for development, diagnostics, and testing.
 */
export function generateSyntheticChange(
  portal: PortalId = 'elms',
  kind: ItemKind = 'material'
): Change {
  return {
    id: crypto.randomUUID(),
    itemId: `${portal}:synthetic:${Date.now()}`,
    type: 'added',
    kind,
    portal,
    courseName: portal === 'elms' ? 'CSE 2213: Advanced Algorithms' : undefined,
    title: `Simulated Update (${kind})`,
    url: portal === 'elms' ? 'https://elms.uiu.ac.bd/my/' : 'https://ucam.uiu.ac.bd/Home.aspx',
    priority: getChangePriority(kind),
    detectedAt: new Date().toISOString(),
    read: false,
  };
}
