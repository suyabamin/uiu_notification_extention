import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isQuietHours,
  isSnoozed,
  filterChangesBySettings,
  formatNotificationContent,
  NotificationManager,
} from './notifications';
import { Change, Settings } from '@/shared/types';
import { DEFAULT_SETTINGS } from '@/shared/defaults';
import { storage } from './storage';

function makeMockChange(overrides: Partial<Change> = {}): Change {
  return {
    id: 'c1234567-0000-0000-0000-000000000001',
    itemId: 'elms:course:1:cm:2',
    type: 'added',
    kind: 'material',
    portal: 'elms',
    courseName: 'CSE 2213',
    title: 'Lecture 1.pdf',
    url: 'https://elms.uiu.ac.bd/mod/resource/view.php?id=2',
    priority: 'normal',
    detectedAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

describe('isQuietHours', () => {
  it('returns false when quiet hours is disabled', () => {
    const qh = { enabled: false, start: '23:00', end: '07:00' };
    const date = new Date(2026, 10, 4, 23, 30); // 11:30 PM
    expect(isQuietHours(qh, date)).toBe(false);
  });

  it('correctly handles midnight-spanning range (e.g. 23:00 to 07:00)', () => {
    const qh = { enabled: true, start: '23:00', end: '07:00' };

    // At 23:30 (inside)
    expect(isQuietHours(qh, new Date(2026, 10, 4, 23, 30))).toBe(true);

    // At 04:15 (inside)
    expect(isQuietHours(qh, new Date(2026, 10, 4, 4, 15))).toBe(true);

    // At 06:59 (inside)
    expect(isQuietHours(qh, new Date(2026, 10, 4, 6, 59))).toBe(true);

    // At 07:01 (outside)
    expect(isQuietHours(qh, new Date(2026, 10, 4, 7, 1))).toBe(false);

    // At 15:00 (outside)
    expect(isQuietHours(qh, new Date(2026, 10, 4, 15, 0))).toBe(false);
  });

  it('correctly handles same-day range (e.g. 13:00 to 17:00)', () => {
    const qh = { enabled: true, start: '13:00', end: '17:00' };

    expect(isQuietHours(qh, new Date(2026, 10, 4, 14, 0))).toBe(true);
    expect(isQuietHours(qh, new Date(2026, 10, 4, 12, 59))).toBe(false);
    expect(isQuietHours(qh, new Date(2026, 10, 4, 17, 1))).toBe(false);
  });
});

describe('isSnoozed', () => {
  it('returns false when no snoozeUntil is set', () => {
    expect(isSnoozed(undefined)).toBe(false);
  });

  it('returns true when snoozeUntil is in the future', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(isSnoozed(future)).toBe(true);
  });

  it('returns false when snoozeUntil has expired', () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    expect(isSnoozed(past)).toBe(false);
  });
});

describe('filterChangesBySettings', () => {
  let settings: Settings;

  beforeEach(() => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  });

  it('filters out changes from disabled portals', () => {
    settings.portals.elms.enabled = false;
    const change = makeMockChange({ portal: 'elms' });
    expect(filterChangesBySettings([change], settings)).toEqual([]);
  });

  it('filters out disabled item kinds', () => {
    settings.enabledKinds.forum_post = false;
    const change = makeMockChange({ kind: 'forum_post' });
    expect(filterChangesBySettings([change], settings)).toEqual([]);
  });

  it('filters out muted courses', () => {
    settings.mutedCourses = ['CSE 2213'];
    const change = makeMockChange({ courseName: 'CSE 2213' });
    expect(filterChangesBySettings([change], settings)).toEqual([]);
  });

  it('filters out courses not in watchedCourses list when not "all"', () => {
    settings.watchedCourses = ['CSE 3311'];
    const change = makeMockChange({ courseName: 'CSE 2213' });
    expect(filterChangesBySettings([change], settings)).toEqual([]);
  });
});

describe('formatNotificationContent', () => {
  it('masks grade details when hideDetails is true', () => {
    const gradeChange = makeMockChange({
      kind: 'grade',
      title: 'Midterm Exam: 28/30 (A)',
    });
    const formatted = formatNotificationContent(gradeChange, true);
    expect(formatted.message).toBe('New grade/result posted');
    expect(formatted.message).not.toContain('28/30');
  });

  it('keeps title when hideDetails is false', () => {
    const gradeChange = makeMockChange({
      kind: 'grade',
      title: 'Midterm Exam: 28/30 (A)',
    });
    const formatted = formatNotificationContent(gradeChange, false);
    expect(formatted.message).toBe('Midterm Exam: 28/30 (A)');
  });
});

describe('NotificationManager dispatch', () => {
  let manager: NotificationManager;

  beforeEach(async () => {
    manager = new NotificationManager();
    await storage.clearAllData();
  });

  it('creates individual notifications when changes <= 5', async () => {
    const spy = vi.spyOn(chrome.notifications, 'create');
    const changes = [
      makeMockChange({ id: '00000000-0000-0000-0000-000000000001', title: 'File 1' }),
      makeMockChange({ id: '00000000-0000-0000-0000-000000000002', title: 'File 2' }),
    ];

    await manager.dispatch(changes);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('change:00000000-0000-0000-0000-000000000001', expect.anything());
  });

  it('groups into a single summary notification when changes > 5', async () => {
    const spy = vi.spyOn(chrome.notifications, 'create');
    const changes: Change[] = [];
    for (let i = 1; i <= 7; i++) {
      changes.push(
        makeMockChange({
          id: `00000000-0000-0000-0000-00000000000${i}`,
          title: `File ${i}`,
        })
      );
    }

    await manager.dispatch(changes);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/^summary:/),
      expect.objectContaining({
        message: '7 new updates available in your UIU portals.',
      })
    );
  });

  it('suppresses desktop notifications during quiet hours', async () => {
    const spy = vi.spyOn(chrome.notifications, 'create');
    await storage.saveSettings({
      quietHours: { enabled: true, start: '00:00', end: '23:59' }, // all day quiet
    });

    await manager.dispatch([makeMockChange()]);
    expect(spy).not.toHaveBeenCalled();
  });
});
