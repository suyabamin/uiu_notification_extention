import { storage } from '@/core/storage';
import { scheduler } from '@/core/scheduler';
import { logger } from '@/core/logger';
import { isValidSender, MessageType } from '@/shared/messaging';

export default defineBackground(() => {
  // On extension install or update
  chrome.runtime.onInstalled.addListener(async (details) => {
    await storage.init();
    await scheduler.setup();
    await logger.info(`UIU Notification installed/updated: ${details.reason}`);
  });

  // On browser startup (service worker restarts)
  chrome.runtime.onStartup.addListener(async () => {
    await storage.init();
    await scheduler.setup();
    await logger.info('UIU Notification started on browser startup');
  });

  // Alarm listener — trigger a check cycle
  scheduler.onAlarm(async (_alarmName) => {
    await runCheckCycle();
  });

  // Message handler for UI ↔ background communication
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Skip offscreen PARSE_HTML messages (handled by offscreen.ts bridge)
    if (message.type === MessageType.PARSE_HTML) return false;

    // Validate sender
    if (!isValidSender(sender)) {
      sendResponse({ error: 'Unauthorized sender' });
      return false;
    }

    handleUiMessage(message, sendResponse);
    return true; // async response
  });
});

async function handleUiMessage(
  message: { type: string; payload?: unknown },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case MessageType.GET_STATE: {
        const [settings, statuses, changes] = await Promise.all([
          storage.getSettings(),
          storage.getAllPortalStatuses(),
          storage.getChanges(),
        ]);
        const unreadCount = changes.filter((c) => !c.read).length;
        sendResponse({ settings, statuses, changes, unreadCount, isChecking: false });
        break;
      }

      case MessageType.CHECK_NOW: {
        const locked = await storage.isCycleLocked();
        if (locked) {
          sendResponse({ started: false, reason: 'Cycle already running' });
        } else {
          runCheckCycle().catch((err) =>
            logger.error('Check cycle failed', { error: (err as Error).message })
          );
          sendResponse({ started: true });
        }
        break;
      }

      case MessageType.MARK_READ: {
        const payload = message.payload as { id?: string; all?: boolean } | undefined;
        if (payload?.all) {
          await storage.markAllChangesRead();
        } else if (payload?.id) {
          await storage.markChangeRead(payload.id);
        }
        await updateBadge();
        sendResponse({ ok: true });
        break;
      }

      case MessageType.UPDATE_SETTINGS: {
        const payload = message.payload as { settings?: Record<string, unknown> } | undefined;
        if (payload?.settings) {
          const updated = await storage.saveSettings(payload.settings as never);
          // Reschedule alarm if interval changed
          await scheduler.reschedule(updated.intervalMinutes);
          sendResponse({ ok: true, settings: updated });
        } else {
          sendResponse({ error: 'No settings provided' });
        }
        break;
      }

      case MessageType.CLEAR_DATA: {
        await storage.clearAllData();
        await updateBadge();
        sendResponse({ ok: true });
        break;
      }

      case MessageType.GET_PORTAL_STATUS: {
        const statuses = await storage.getAllPortalStatuses();
        sendResponse({ statuses });
        break;
      }

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await logger.error('Message handler error', { type: message.type, error: errorMessage });
    sendResponse({ error: errorMessage });
  }
}

async function runCheckCycle(): Promise<void> {
  const acquired = await storage.acquireCycleLock();
  if (!acquired) {
    await logger.info('Skipping cycle: another cycle is running');
    return;
  }

  try {
    await logger.info('Check cycle started');
    // Portal-specific orchestration will be added in Phase 4 and 5
    await logger.info('Check cycle completed (no adapters yet)');
  } finally {
    await storage.releaseCycleLock();
    await updateBadge();
  }
}

async function updateBadge(): Promise<void> {
  try {
    const changes = await storage.getChanges();
    const unread = changes.filter((c) => !c.read);
    const count = unread.length;

    if (count === 0) {
      await chrome.action.setBadgeText({ text: '' });
    } else {
      const label = count > 99 ? '99+' : String(count);
      const hasHighPriority = unread.some((c) => c.priority === 'high');
      await chrome.action.setBadgeText({ text: label });
      await chrome.action.setBadgeBackgroundColor({
        color: hasHighPriority ? '#DC2626' : '#2563EB',
      });
    }
  } catch {
    // Badge update failure should not crash the cycle
  }
}
