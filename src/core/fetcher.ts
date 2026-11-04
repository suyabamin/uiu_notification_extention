import { isAllowedUrl } from '@/shared/url';
import { SCHEDULER_CONFIG } from '@/shared/constants';

export interface FetchResult {
  status: number;
  finalUrl: string;
  html: string;
  ok: boolean;
  redirectedToLogin: boolean;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_FETCH_OPTIONS: Required<FetchOptions> = {
  timeoutMs: SCHEDULER_CONFIG.REQUEST_TIMEOUT_MS,
  maxRetries: SCHEDULER_CONFIG.MAX_RETRIES,
};

/**
 * Validates URL, fetches with credentials, handles retries and backoff.
 * Only allows GET requests to the two allowed portal hosts.
 * Never follows a redirect to a disallowed host.
 */
export async function fetchPortalPage(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };

  if (!isAllowedUrl(url)) {
    throw new Error(`URL not in allow-list: ${url}`);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, ...
      const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
      await delay(backoffMs);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        redirect: 'follow',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Validate the final URL after redirects
      const finalUrl = response.url || url;
      if (!isAllowedUrl(finalUrl)) {
        throw new FetchError(`Redirect to disallowed URL: ${finalUrl}`, 0, true);
      }

      // Handle 429 by throwing a specific error (caller will back off the portal)
      if (response.status === 429) {
        throw new TooManyRequestsError();
      }

      // Retry on 5xx server errors
      if (response.status >= 500) {
        lastError = new Error(`Server error: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Detect redirect to login page (session expiry)
      const redirectedToLogin = detectLoginRedirect(finalUrl);

      return {
        status: response.status,
        finalUrl,
        html,
        ok: response.ok,
        redirectedToLogin,
      };
    } catch (err) {
      clearTimeout(timeoutId);

      // Don't retry 429 or redirect-to-disallowed-URL errors
      if (err instanceof TooManyRequestsError || err instanceof FetchError) {
        throw err;
      }

      // AbortController timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${opts.timeoutMs}ms`);
      } else if (err instanceof Error) {
        lastError = err;
      } else {
        lastError = new Error('Unknown fetch error');
      }

      // On last retry, throw
      if (attempt === opts.maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Fetch failed after all retries');
}

function detectLoginRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return path.includes('/login/index.php') || path.includes('/security/login.aspx');
  } catch {
    return false;
  }
}

export class TooManyRequestsError extends Error {
  constructor() {
    super('HTTP 429: Rate limited');
    this.name = 'TooManyRequestsError';
  }
}

export class FetchError extends Error {
  public readonly statusCode: number;
  public readonly isRedirectViolation: boolean;

  constructor(message: string, statusCode: number, isRedirectViolation = false) {
    super(message);
    this.name = 'FetchError';
    this.statusCode = statusCode;
    this.isRedirectViolation = isRedirectViolation;
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a random delay in [min, max] ms for sequential request pacing.
 */
export function sequentialDelay(): Promise<void> {
  const ms =
    SCHEDULER_CONFIG.SEQUENTIAL_DELAY_MS_MIN +
    Math.random() *
      (SCHEDULER_CONFIG.SEQUENTIAL_DELAY_MS_MAX - SCHEDULER_CONFIG.SEQUENTIAL_DELAY_MS_MIN);
  return delay(ms);
}
