import { describe, it, expect } from 'vitest';
import {
  diffSnapshots,
  normalizeText,
  computeItemHash,
  getChangePriority,
  generateSyntheticChange,
} from './diff';
import { Snapshot, Item } from '@/shared/types';

function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'elms:course:1:cm:101',
    portal: 'elms',
    kind: 'material',
    courseName: 'CSE 1111',
    title: 'Lecture 1 Slides.pdf',
    url: 'https://elms.uiu.ac.bd/mod/resource/view.php?id=101',
    hash: 'hash-initial-101',
    visible: true,
    ...overrides,
  };
}

function createMockSnapshot(items: Record<string, Item>, overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    portal: 'elms',
    takenAt: new Date().toISOString(),
    parserVersion: '1.0.0',
    items,
    health: { ok: true, warnings: [] },
    ...overrides,
  };
}

describe('normalizeText', () => {
  it('strips sesskey tokens and collapses whitespace', () => {
    const raw = 'Assignment 1?sesskey=abc123XYZ_45   due tomorrow';
    const clean = normalizeText(raw);
    expect(clean).toBe('Assignment 1? due tomorrow');
  });

  it('strips relative timestamps like "3 hours ago"', () => {
    const raw = 'Lecture Notes (Updated 2 hours ago)';
    const clean = normalizeText(raw);
    expect(clean).toBe('Lecture Notes (Updated )');
  });
});

describe('computeItemHash', () => {
  it('generates deterministic SHA-256 hash', async () => {
    const hash1 = await computeItemHash({
      title: 'Assignment 1',
      url: 'https://elms.uiu.ac.bd/mod/assign/view.php?id=5',
      dueAt: '2026-11-10T23:59:00Z',
    });
    const hash2 = await computeItemHash({
      title: 'Assignment 1',
      url: 'https://elms.uiu.ac.bd/mod/assign/view.php?id=5',
      dueAt: '2026-11-10T23:59:00Z',
    });
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes when fields change', async () => {
    const hash1 = await computeItemHash({
      title: 'Assignment 1',
      url: 'https://elms.uiu.ac.bd/mod/assign/view.php?id=5',
      dueAt: '2026-11-10T23:59:00Z',
    });
    const hash2 = await computeItemHash({
      title: 'Assignment 1 (Extended)',
      url: 'https://elms.uiu.ac.bd/mod/assign/view.php?id=5',
      dueAt: '2026-11-12T23:59:00Z',
    });
    expect(hash1).not.toBe(hash2);
  });
});

describe('getChangePriority', () => {
  it('assigns high priority to grades, announcements, and notices', () => {
    expect(getChangePriority('grade')).toBe('high');
    expect(getChangePriority('result')).toBe('high');
    expect(getChangePriority('announcement')).toBe('high');
    expect(getChangePriority('notice')).toBe('high');
    expect(getChangePriority('assignment')).toBe('high');
  });

  it('assigns normal priority to materials, quizzes, and routines', () => {
    expect(getChangePriority('material')).toBe('normal');
    expect(getChangePriority('quiz')).toBe('normal');
    expect(getChangePriority('routine')).toBe('normal');
  });

  it('assigns low priority to forum posts', () => {
    expect(getChangePriority('forum_post')).toBe('low');
  });

  it('upgrades hidden-to-visible materials to high priority', () => {
    expect(getChangePriority('material', true)).toBe('high');
  });
});

describe('diffSnapshots', () => {
  it('returns empty changes for initial baseline scan (oldSnapshot null)', () => {
    const newSnapshot = createMockSnapshot({
      'item-1': createMockItem({ id: 'item-1' }),
    });

    const result = diffSnapshots(null, newSnapshot);
    expect(result.changes).toEqual([]);
    expect(result.isParserSuspect).toBe(false);
  });

  it('detects newly added items', () => {
    const item1 = createMockItem({ id: 'item-1' });
    const item2 = createMockItem({ id: 'item-2', title: 'New Quiz', kind: 'quiz' });

    const oldSnapshot = createMockSnapshot({ 'item-1': item1 });
    const newSnapshot = createMockSnapshot({ 'item-1': item1, 'item-2': item2 });

    const result = diffSnapshots(oldSnapshot, newSnapshot);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].type).toBe('added');
    expect(result.changes[0].itemId).toBe('item-2');
    expect(result.changes[0].title).toBe('New Quiz');
    expect(result.changes[0].priority).toBe('normal');
  });

  it('detects modified items with details', () => {
    const oldItem = createMockItem({
      id: 'item-1',
      title: 'Assignment 1',
      dueAt: '2026-11-05T12:00:00Z',
      hash: 'hash-v1',
    });
    const newItem = createMockItem({
      id: 'item-1',
      title: 'Assignment 1 (Extended)',
      dueAt: '2026-11-08T12:00:00Z',
      hash: 'hash-v2',
    });

    const oldSnapshot = createMockSnapshot({ 'item-1': oldItem });
    const newSnapshot = createMockSnapshot({ 'item-1': newItem });

    const result = diffSnapshots(oldSnapshot, newSnapshot);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].type).toBe('modified');
    expect(result.changes[0].details).toEqual([
      { field: 'title', from: 'Assignment 1', to: 'Assignment 1 (Extended)' },
      { field: 'dueAt', from: '2026-11-05T12:00:00Z', to: '2026-11-08T12:00:00Z' },
    ]);
  });

  it('treats hidden -> visible transition as added with high priority', () => {
    const oldItem = createMockItem({ id: 'item-1', visible: false, hash: 'hash-hidden' });
    const newItem = createMockItem({ id: 'item-1', visible: true, hash: 'hash-visible' });

    const oldSnapshot = createMockSnapshot({ 'item-1': oldItem });
    const newSnapshot = createMockSnapshot({ 'item-1': newItem });

    const result = diffSnapshots(oldSnapshot, newSnapshot);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].type).toBe('added');
    expect(result.changes[0].priority).toBe('high');
  });

  it('detects normal removals when parser health is OK and count >= 50%', () => {
    const items: Record<string, Item> = {};
    for (let i = 1; i <= 6; i++) {
      items[`item-${i}`] = createMockItem({ id: `item-${i}` });
    }
    const oldSnapshot = createMockSnapshot(items);

    // Remove 2 out of 6 items (4 remaining = 66% >= 50%)
    const newItems = { ...items };
    delete newItems['item-5'];
    delete newItems['item-6'];
    const newSnapshot = createMockSnapshot(newItems);

    const result = diffSnapshots(oldSnapshot, newSnapshot);
    expect(result.isParserSuspect).toBe(false);
    expect(result.changes.length).toBe(2);
    expect(result.changes.every((c) => c.type === 'removed')).toBe(true);
  });

  it('flags PARSER_SUSPECT and suppresses removals when item count drops drastically (<50%)', () => {
    const items: Record<string, Item> = {};
    for (let i = 1; i <= 10; i++) {
      items[`item-${i}`] = createMockItem({ id: `item-${i}` });
    }
    const oldSnapshot = createMockSnapshot(items);

    // Drastic drop from 10 items to 2 items (20% < 50%)
    const newItems = {
      'item-1': items['item-1'],
      'item-2': items['item-2'],
    };
    const newSnapshot = createMockSnapshot(newItems);

    const result = diffSnapshots(oldSnapshot, newSnapshot);
    expect(result.isParserSuspect).toBe(true);
    // Removals should be suppressed
    expect(result.changes.filter((c) => c.type === 'removed').length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('generateSyntheticChange', () => {
  it('creates a valid change object for testing and dev', () => {
    const change = generateSyntheticChange('ucam', 'notice');
    expect(change.portal).toBe('ucam');
    expect(change.kind).toBe('notice');
    expect(change.priority).toBe('high');
    expect(change.read).toBe(false);
    expect(change.url).toBe('https://ucam.uiu.ac.bd/Home.aspx');
  });
});
