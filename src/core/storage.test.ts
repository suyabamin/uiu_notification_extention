import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from './storage';
import { Snapshot, Change } from '@/shared/types';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(async () => {
    storage = new StorageService();
    await storage.clearAllData();
  });

  it('initializes default settings on clean install', async () => {
    const settings = await storage.getSettings();
    expect(settings.intervalMinutes).toBe(15);
    expect(settings.portals.elms.enabled).toBe(true);
    expect(settings.portals.ucam.enabled).toBe(true);
    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('system');
  });

  it('updates settings with partial values without losing existing settings', async () => {
    await storage.saveSettings({ intervalMinutes: 30, sound: true });
    const settings = await storage.getSettings();
    expect(settings.intervalMinutes).toBe(30);
    expect(settings.sound).toBe(true);
    expect(settings.portals.elms.enabled).toBe(true);
  });

  it('rejects invalid settings via zod validation', async () => {
    await expect(
      storage.saveSettings({
        // @ts-expect-error Testing invalid runtime value
        intervalMinutes: 5, // 5 is not allowed (floor is 10)
      })
    ).rejects.toThrow();
  });

  it('saves and retrieves snapshots per portal', async () => {
    const mockSnapshot: Snapshot = {
      portal: 'elms',
      takenAt: new Date().toISOString(),
      parserVersion: '1.0.0',
      items: {
        'elms:course:1:cm:2': {
          id: 'elms:course:1:cm:2',
          portal: 'elms',
          kind: 'material',
          courseName: 'CSE 1111',
          title: 'Slides 1',
          url: 'https://elms.uiu.ac.bd/mod/resource/view.php?id=2',
          hash: 'hash123',
        },
      },
      health: { ok: true, warnings: [] },
    };

    await storage.saveSnapshot(mockSnapshot);
    const retrieved = await storage.getSnapshot('elms');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.portal).toBe('elms');
    expect(retrieved?.items['elms:course:1:cm:2'].title).toBe('Slides 1');

    const ucamSnapshot = await storage.getSnapshot('ucam');
    expect(ucamSnapshot).toBeNull();
  });

  it('appends and retrieves changes and limits history', async () => {
    const change1: Change = {
      id: '00000000-0000-0000-0000-000000000001',
      itemId: 'elms:course:1:cm:2',
      type: 'added',
      kind: 'material',
      portal: 'elms',
      title: 'Slides 1',
      url: 'https://elms.uiu.ac.bd/mod/resource/view.php?id=2',
      priority: 'normal',
      detectedAt: new Date().toISOString(),
      read: false,
    };

    await storage.appendChanges([change1]);
    let changes = await storage.getChanges();
    expect(changes.length).toBe(1);
    expect(changes[0].read).toBe(false);

    await storage.markChangeRead(change1.id);
    changes = await storage.getChanges();
    expect(changes[0].read).toBe(true);
  });

  it('prunes items older than 90 days', async () => {
    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const oldChange: Change = {
      id: '00000000-0000-0000-0000-000000000002',
      itemId: 'elms:item:old',
      type: 'added',
      kind: 'material',
      portal: 'elms',
      title: 'Old item',
      url: 'https://elms.uiu.ac.bd/item',
      priority: 'low',
      detectedAt: oldDate,
      read: true,
    };

    await storage.appendChanges([oldChange]);
    const changes = await storage.getChanges();
    expect(changes.length).toBe(0);
  });

  it('manages cycle mutex lock properly', async () => {
    expect(await storage.isCycleLocked()).toBe(false);
    const acquired = await storage.acquireCycleLock();
    expect(acquired).toBe(true);
    expect(await storage.isCycleLocked()).toBe(true);

    // Second acquire should fail while locked
    const secondAcquire = await storage.acquireCycleLock();
    expect(secondAcquire).toBe(false);

    await storage.releaseCycleLock();
    expect(await storage.isCycleLocked()).toBe(false);
  });

  it('enforces session warning 6-hour rate limit', async () => {
    expect(await storage.canShowSessionWarning('elms')).toBe(true);
    await storage.recordSessionWarning('elms');
    expect(await storage.canShowSessionWarning('elms')).toBe(false);

    // UCAM is independent
    expect(await storage.canShowSessionWarning('ucam')).toBe(true);
  });

  it('manages portal statuses', async () => {
    await storage.updatePortalStatus('elms', { state: 'login_required' });
    const status = await storage.getPortalStatus('elms');
    expect(status.state).toBe('login_required');

    const ucamStatus = await storage.getPortalStatus('ucam');
    expect(ucamStatus.state).toBe('connected');
  });
});
