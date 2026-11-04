import { Change, Settings, PortalStatus } from '@/shared/types';
import { storage } from './storage';
import { logger } from './logger';
import { isAllowedUrl } from '@/shared/url';
import { SCHEDULER_CONFIG } from '@/shared/constants';

/**
 * Checks whether the given date/time falls within quiet hours.
 * Handles ranges spanning midnight, e.g. 23:00 to 07:00.
 */
export function isQuietHours(
  quietHours: { enabled: boolean; start: string; end: string },
  now: Date = new Date()
): boolean {
  if (!quietHours.enabled) return false;

  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Normal range during the same day (e.g. 13:00 to 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Midnight spanning range (e.g. 23:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Checks whether notifications are currently snoozed.
 */
export function isSnoozed(snoozeUntil?: string, now: Date = new Date()): boolean {
  if (!snoozeUntil) return false;
  return new Date(snoozeUntil) > now;
}

/**
 * Filters a list of changes against the user's active settings.
 */
export function filterChangesBySettings(changes: Change[], settings: Settings): Change[] {
  return changes.filter((change) => {
    // 1. Portal enabled?
    if (!settings.portals[change.portal]?.enabled) {
      return false;
    }

    // 2. Kind enabled?
    if (settings.enabledKinds[change.kind] === false) {
      return false;
    }

    // 3. Muted course?
    if (change.courseName && settings.mutedCourses.includes(change.courseName)) {
      return false;
    }

    // 4. Watched courses filter (for ELMS courses)
    if (
      settings.watchedCourses !== 'all' &&
      change.courseName &&
      !settings.watchedCourses.includes(change.courseName)
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Formats notification title and message, respecting "hide details" privacy option.
 */
export function formatNotificationContent(
  change: Change,
  hideDetails: boolean
): { title: string; message: string } {
  const portalPrefix = change.portal === 'elms' ? 'ELMS' : 'UCAM';
  const coursePrefix = change.courseName ? `${change.courseName}` : portalPrefix;

  let message = change.title;

  if (change.kind === 'grade' || change.kind === 'result') {
    if (hideDetails) {
      message = 'New grade/result posted';
    }
  } else if (change.type === 'modified' && change.details && change.details.length > 0) {
    const dueDetail = change.details.find((d) => d.field === 'dueAt');
    if (dueDetail) {
      message = `${change.title} (due date updated)`;
    }
  }

  return {
    title: `${coursePrefix} · ${change.title}`,
    message,
  };
}

export class NotificationManager {
  private registeredListeners = false;

  /**
   * Initializes click-to-open and button listeners.
   */
  init(): void {
    if (this.registeredListeners) return;

    if (typeof chrome !== 'undefined' && chrome.notifications?.onClicked) {
      chrome.notifications.onClicked.addListener(async (notifId: string) => {
        await this.handleNotificationClick(notifId);
      });
    }

    this.registeredListeners = true;
  }

  /**
   * Dispatches notifications for new changes.
   * Handles grouping (>5 changes), quiet hours, snooze, and badge update.
   */
  async dispatch(rawChanges: Change[]): Promise<void> {
    if (rawChanges.length === 0) return;

    const settings = await storage.getSettings();
    const filtered = filterChangesBySettings(rawChanges, settings);
    if (filtered.length === 0) return;

    // Check quiet hours & snooze
    const quiet = isQuietHours(settings.quietHours);
    const snoozed = isSnoozed(settings.snoozeUntil);

    if (!quiet && !snoozed) {
      if (filtered.length > SCHEDULER_CONFIG.SUMMARY_NOTIFICATION_THRESHOLD) {
        // Show summary notification
        await this.showSummaryNotification(filtered.length);
      } else {
        // Show individual notifications
        for (const change of filtered) {
          await this.showSingleNotification(change, settings.hideDetailsInNotifications);
        }
      }
    } else {
      await logger.info(
        `Desktop notifications suppressed (${quiet ? 'Quiet Hours' : 'Snoozed'})`,
        { count: filtered.length }
      );
    }

    // Always update toolbar badge
    await this.updateBadge();
  }

  private async showSingleNotification(
    change: Change,
    hideDetails: boolean
  ): Promise<void> {
    const { title, message } = formatNotificationContent(change, hideDetails);
    const notifId = `change:${change.id}`;

    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/48.png'),
        title,
        message,
        priority: change.priority === 'high' ? 2 : change.priority === 'normal' ? 0 : -1,
      });
    } catch (err) {
      await logger.error('Failed to create notification', {
        error: (err as Error).message,
        changeId: change.id,
      });
    }
  }

  private async showSummaryNotification(count: number): Promise<void> {
    const notifId = `summary:${Date.now()}`;
    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/48.png'),
        title: 'UIU Notification',
        message: `${count} new updates available in your UIU portals.`,
      });
    } catch (err) {
      await logger.error('Failed to create summary notification', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Handles user click on a notification.
   * Opens the destination URL (if allowed) and marks the change read.
   */
  async handleNotificationClick(notifId: string): Promise<void> {
    try {
      if (notifId.startsWith('change:')) {
        const changeId = notifId.replace('change:', '');
        const changes = await storage.getChanges();
        const change = changes.find((c) => c.id === changeId);

        if (change) {
          await storage.markChangeRead(change.id);
          await this.updateBadge();

          if (isAllowedUrl(change.url)) {
            await chrome.tabs.create({ url: change.url });
          }
        }
      } else if (notifId.startsWith('summary:')) {
        // Open extension popup or dashboard
        const dashboardUrl = chrome.runtime.getURL('dashboard/index.html');
        await chrome.tabs.create({ url: dashboardUrl });
      }

      await chrome.notifications.clear(notifId);
    } catch (err) {
      await logger.error('Error handling notification click', {
        error: (err as Error).message,
        notifId,
      });
    }
  }

  /**
   * Refreshes toolbar badge text and background color.
   */
  async updateBadge(portalStatuses?: Record<string, PortalStatus>): Promise<void> {
    try {
      const statuses = portalStatuses || (await storage.getAllPortalStatuses());

      // If either portal requires login, show "!" alert on badge
      const needsLogin =
        statuses.elms?.state === 'login_required' || statuses.ucam?.state === 'login_required';

      if (needsLogin) {
        await chrome.action.setBadgeText({ text: '!' });
        await chrome.action.setBadgeBackgroundColor({ color: '#D97706' }); // Amber warning
        return;
      }

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
      // Badge update errors are non-fatal
    }
  }
}

export const notificationManager = new NotificationManager();
