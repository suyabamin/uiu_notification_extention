export const EXTENSION_NAME = 'UIU Notification';

export const ALLOWED_HOSTS = ['ucam.uiu.ac.bd', 'elms.uiu.ac.bd'] as const;
export type AllowedHost = (typeof ALLOWED_HOSTS)[number];

export const PORTAL_URLS = {
  elms: {
    base: 'https://elms.uiu.ac.bd',
    login: 'https://elms.uiu.ac.bd/login/index.php',
    courses: 'https://elms.uiu.ac.bd/my/courses.php',
    dashboard: 'https://elms.uiu.ac.bd/my/',
    calendar: 'https://elms.uiu.ac.bd/calendar/view.php?view=upcoming',
    notifications: 'https://elms.uiu.ac.bd/message/output/popup/notifications.php',
  },
  ucam: {
    base: 'https://ucam.uiu.ac.bd',
    login: 'https://ucam.uiu.ac.bd/Security/LogIn.aspx',
    home: 'https://ucam.uiu.ac.bd/Home.aspx',
  },
} as const;

export const SCHEDULER_CONFIG = {
  DEFAULT_INTERVAL_MINUTES: 15,
  MINIMUM_INTERVAL_MINUTES: 10,
  JITTER_RATIO: 0.2, // +/- 20%
  SEQUENTIAL_DELAY_MS_MIN: 1000,
  SEQUENTIAL_DELAY_MS_MAX: 2000,
  REQUEST_TIMEOUT_MS: 20000,
  MAX_RETRIES: 2,
  RATE_LIMIT_429_BACKOFF_MS: 60 * 60 * 1000, // 1 hour
  SESSION_WARNING_INTERVAL_MS: 6 * 60 * 60 * 1000, // 6 hours
  HISTORY_MAX_ITEMS: 1000,
  HISTORY_MAX_DAYS: 90,
  LOG_MAX_ENTRIES: 200,
  LAYOUT_BREAK_THRESHOLD_RATIO: 0.5, // flag PARSER_SUSPECT if new snapshot has < 50% old item count
  SUMMARY_NOTIFICATION_THRESHOLD: 5,
} as const;

export const DEFAULT_QUIET_HOURS = {
  enabled: false,
  start: '23:00',
  end: '07:00',
};
