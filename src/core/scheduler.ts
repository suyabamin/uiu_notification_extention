import { storage } from './storage';
import { logger } from './logger';
import { SCHEDULER_CONFIG } from '@/shared/constants';

const ALARM_NAME = 'uiu-notification-check';

/**
 * Applies ±20% jitter to an interval in minutes.
 */
export function applyJitter(intervalMinutes: number): number {
  const jitter = intervalMinutes * SCHEDULER_CONFIG.JITTER_RATIO;
  return intervalMinutes + (Math.random() * 2 - 1) * jitter;
}

/**
 * Ensures the interval stays within allowed bounds.
 */
export function clampInterval(intervalMinutes: number): number {
  return Math.max(SCHEDULER_CONFIG.MINIMUM_INTERVAL_MINUTES, intervalMinutes);
}

/**
 * Returns the effective polling interval in minutes with jitter applied.
 */
export function computeEffectiveInterval(intervalMinutes: number): number {
  return clampInterval(applyJitter(clampInterval(intervalMinutes)));
}

export class Scheduler {
  /**
   * Sets up the alarm for periodic checks.
   * Call this on extension install and startup.
   */
  async setup(): Promise<void> {
    const settings = await storage.getSettings();
    const effectiveInterval = computeEffectiveInterval(settings.intervalMinutes);
    await this.scheduleAlarm(effectiveInterval);
    await logger.info(`Scheduler initialized: ${effectiveInterval.toFixed(1)} min interval`);
  }

  /**
   * Reschedules the alarm with the given interval (with jitter).
   */
  async reschedule(intervalMinutes: number): Promise<void> {
    const effective = computeEffectiveInterval(intervalMinutes);
    await this.scheduleAlarm(effective);
  }

  private async scheduleAlarm(periodInMinutes: number): Promise<void> {
    // Clear any existing alarm first
    await chrome.alarms.clear(ALARM_NAME);
    // Schedule with the effective period
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: periodInMinutes,
      periodInMinutes,
    });
  }

  /**
   * Registers the alarm listener. Returns a cleanup function.
   */
  onAlarm(callback: (alarmName: string) => void): () => void {
    const listener = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === ALARM_NAME) {
        callback(alarm.name);
      }
    };
    chrome.alarms.onAlarm.addListener(listener);
    return () => chrome.alarms.onAlarm.removeListener(listener);
  }
}

export const scheduler = new Scheduler();
