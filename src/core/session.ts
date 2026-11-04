import { PortalId } from '@/shared/types';
import { PORTAL_URLS } from '@/shared/constants';

export type SessionState = 'logged_in' | 'login_required';

/**
 * Checks whether the given Document + finalUrl indicate a logged-in session.
 * Uses multiple heuristics documented in PORTAL_ADAPTERS.md.
 * Returns 'logged_in' or 'login_required'.
 */
export function checkElmsSession(doc: Document, finalUrl: string): SessionState {
  // Check 1: Final URL is the login page
  if (detectLoginUrl(finalUrl, 'elms')) {
    return 'login_required';
  }

  // Check 2: Login form present (form#login or form with password field)
  if (doc.querySelector('form#login') || doc.querySelector('input[type="password"]')) {
    return 'login_required';
  }

  // Check 3: No logout link / user menu
  const hasLogout =
    !!doc.querySelector('a[href*="logout.php"]') ||
    !!doc.querySelector('[data-action="logout"]') ||
    !!doc.querySelector('.usermenu') ||
    !!doc.querySelector('[aria-label*="User menu"]');

  if (!hasLogout) {
    return 'login_required';
  }

  return 'logged_in';
}

export function checkUcamSession(doc: Document, finalUrl: string): SessionState {
  // Check 1: Final URL contains the UCAM login path
  if (detectLoginUrl(finalUrl, 'ucam')) {
    return 'login_required';
  }

  // Check 2: Password input field present (login form)
  if (doc.querySelector('input[type="password"]')) {
    return 'login_required';
  }

  // Check 3: Look for a logout link or student name header
  const hasLogout =
    !!doc.querySelector('a[href*="LogOut"]') ||
    !!doc.querySelector('a[href*="Logout"]') ||
    !!doc.querySelector('a[href*="logout"]') ||
    !!doc.querySelector('.logout') ||
    !!doc.querySelector('#logout');

  if (!hasLogout) {
    return 'login_required';
  }

  return 'logged_in';
}

/**
 * Checks if the given URL is a login/redirect URL for the portal.
 */
export function detectLoginUrl(url: string, portal: PortalId): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    if (portal === 'elms') {
      return path.includes('/login/index.php');
    } else {
      return path.includes('/security/login.aspx');
    }
  } catch {
    return false;
  }
}

/**
 * Returns the login page URL for a given portal.
 */
export function getLoginUrl(portal: PortalId): string {
  return portal === 'elms' ? PORTAL_URLS.elms.login : PORTAL_URLS.ucam.login;
}

/**
 * Convenience wrapper — calls the correct session checker for the given portal.
 */
export function checkSession(
  portal: PortalId,
  doc: Document,
  finalUrl: string
): SessionState {
  if (portal === 'elms') {
    return checkElmsSession(doc, finalUrl);
  } else {
    return checkUcamSession(doc, finalUrl);
  }
}
