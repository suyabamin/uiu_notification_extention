import { LogEntry, PortalId } from '@/shared/types';
import { SCHEDULER_CONFIG } from '@/shared/constants';

const LOG_STORAGE_KEY = 'logs';

// Sensitive patterns to scrub from messages and objects
const SENSITIVE_PATTERNS: RegExp[] = [
  /sesskey=[a-zA-Z0-9_-]+/gi,
  /__VIEWSTATE=[a-zA-Z0-9_+/=\s-]+/gi,
  /__EVENTVALIDATION=[a-zA-Z0-9_+/=\s-]+/gi,
  /cookie[:=]\s*[^;\s\n]+/gi,
  /password[:=]\s*[^;\s\n]+/gi,
  /token[:=]\s*[^;\s\n]+/gi,
  /MoodleSession=[a-zA-Z0-9]+/gi,
  /ASP\.NET_SessionId=[a-zA-Z0-9]+/gi,
  /\b011\d{5,8}\b/g, // UIU student ID pattern (e.g. 011211001)
];

export function redactSensitiveText(input: string): string {
  if (!input) return input;
  let redacted = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

export function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('cookie') ||
      lowerKey.includes('token') ||
      lowerKey.includes('pass') ||
      lowerKey.includes('sesskey') ||
      lowerKey.includes('viewstate') ||
      lowerKey.includes('eventvalidation') ||
      lowerKey.includes('html') ||
      lowerKey.includes('body')
    ) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'string') {
      // Also truncate long strings to prevent HTML leakage
      const sanitized = redactSensitiveText(val);
      result[key] = sanitized.length > 500 ? sanitized.slice(0, 500) + '...[truncated]' : sanitized;
    } else if (typeof val === 'object' && val !== null) {
      try {
        result[key] = JSON.parse(redactSensitiveText(JSON.stringify(val)));
      } catch {
        result[key] = '[Object]';
      }
    } else {
      result[key] = val;
    }
  }

  return result;
}

export class LoggerService {
  async log(
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>,
    portal?: PortalId
  ): Promise<void> {
    const cleanMessage = redactSensitiveText(message);
    const cleanContext = sanitizeContext(context);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      portal,
      message: cleanMessage,
      context: cleanContext,
    };

    // Print to console only in non-production or if safe
    if (level === 'error') {
      console.error(`[UIU Notifier][${level.toUpperCase()}]`, cleanMessage);
    } else if (level === 'warn') {
      console.warn(`[UIU Notifier][${level.toUpperCase()}]`, cleanMessage);
    }

    try {
      const raw = await chrome.storage.local.get(LOG_STORAGE_KEY);
      const existing: LogEntry[] = Array.isArray(raw[LOG_STORAGE_KEY]) ? raw[LOG_STORAGE_KEY] : [];
      const updated = [entry, ...existing].slice(0, SCHEDULER_CONFIG.LOG_MAX_ENTRIES);
      await chrome.storage.local.set({ [LOG_STORAGE_KEY]: updated });
    } catch {
      // Storage failure should not crash logger
    }
  }

  async info(message: string, context?: Record<string, unknown>, portal?: PortalId): Promise<void> {
    await this.log('info', message, context, portal);
  }

  async warn(message: string, context?: Record<string, unknown>, portal?: PortalId): Promise<void> {
    await this.log('warn', message, context, portal);
  }

  async error(message: string, context?: Record<string, unknown>, portal?: PortalId): Promise<void> {
    await this.log('error', message, context, portal);
  }

  async getLogs(): Promise<LogEntry[]> {
    const raw = await chrome.storage.local.get(LOG_STORAGE_KEY);
    return Array.isArray(raw[LOG_STORAGE_KEY]) ? raw[LOG_STORAGE_KEY] : [];
  }

  async clear(): Promise<void> {
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: [] });
  }
}

export const logger = new LoggerService();
