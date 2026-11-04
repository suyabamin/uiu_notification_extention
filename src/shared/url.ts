import { ALLOWED_HOSTS } from './constants';

/**
 * Validates whether a URL is safe to fetch or open.
 *
 * Rules:
 * 1. Must be a parseable URL.
 * 2. Protocol must be strictly 'https:'.
 * 3. Username and password (userinfo) must be empty.
 * 4. Hostname must strictly match one of the allowed portal hosts (no subdomains, no suffix matches).
 * 5. Port must be empty or standard 443.
 */
export function isAllowedUrl(urlString: string | null | undefined): boolean {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }

  const trimmed = urlString.trim();
  if (!trimmed) {
    return false;
  }

  // Reject javascript:, data:, and other dangerous protocols immediately
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);

    // Protocol must be https:
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // No credentials allowed in URL
    if (parsed.username || parsed.password) {
      return false;
    }

    // Port must be empty or 443
    if (parsed.port && parsed.port !== '443') {
      return false;
    }

    // Strict hostname check
    const hostname = parsed.hostname.toLowerCase();
    const isAllowedHost = (ALLOWED_HOSTS as readonly string[]).includes(hostname);

    return isAllowedHost;
  } catch {
    return false;
  }
}

/**
 * Resolves a potentially relative URL against an allowed base URL.
 * Returns null if the resulting URL is not allowed.
 */
export function resolvePortalUrl(relativeOrAbsolute: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(relativeOrAbsolute, baseUrl);
    const resolvedString = resolved.toString();
    return isAllowedUrl(resolvedString) ? resolvedString : null;
  } catch {
    return null;
  }
}
