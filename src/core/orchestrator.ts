import { storage } from './storage';
import { logger } from './logger';
import { checkSession, getLoginUrl } from './session';
import { fetchPortalPage, TooManyRequestsError, sequentialDelay } from './fetcher';
import { PortalId } from '@/shared/types';
import { PORTAL_URLS } from '@/shared/constants';

/**
 * Checks whether a portal session is active.
 * Handles the "login required" notification (rate-limited to once per 6 hours).
 * Updates portal status in storage.
 * Returns 'logged_in' | 'login_required' | 'error'.
 */
export async function runSessionCheck(
  portal: PortalId
): Promise<'logged_in' | 'login_required' | 'error'> {
  const baseUrl =
    portal === 'elms' ? PORTAL_URLS.elms.dashboard : PORTAL_URLS.ucam.home;

  try {
    const result = await fetchPortalPage(baseUrl);

    // Parse in the offscreen document context (here we do a lightweight inline check
    // since we only need session signals, not full structured data)
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const sessionState = checkSession(portal, doc, result.finalUrl);

    if (sessionState === 'login_required' || result.redirectedToLogin) {
      await storage.updatePortalStatus(portal, {
        state: 'login_required',
        lastCheckAt: new Date().toISOString(),
      });

      // Show "login required" notification at most once per 6 hours
      const canWarn = await storage.canShowSessionWarning(portal);
      if (canWarn) {
        await showLoginRequiredNotification(portal);
        await storage.recordSessionWarning(portal);
      }

      return 'login_required';
    }

    // Successful session check
    await storage.updatePortalStatus(portal, {
      state: 'connected',
      lastCheckAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      lastError: undefined,
      backoffUntil: undefined,
    });

    return 'logged_in';
  } catch (err) {
    if (err instanceof TooManyRequestsError) {
      const backoffUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await storage.updatePortalStatus(portal, {
        state: 'error',
        lastCheckAt: new Date().toISOString(),
        lastError: 'Rate limited (HTTP 429)',
        backoffUntil,
      });
      await logger.warn(`Portal ${portal} rate-limited, backing off 1h`, {}, portal);
      return 'error';
    }

    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await storage.updatePortalStatus(portal, {
      state: 'error',
      lastCheckAt: new Date().toISOString(),
      lastError: errorMessage,
    });
    await logger.error(`Session check failed for ${portal}`, { error: errorMessage }, portal);
    return 'error';
  }
}

async function showLoginRequiredNotification(portal: PortalId): Promise<void> {
  const portalName = portal === 'elms' ? 'ELMS' : 'UCAM';
  const loginUrl = getLoginUrl(portal);

  try {
    await chrome.notifications.create(`login-required-${portal}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon/48.png'),
      title: `UIU Notification — ${portalName} Login Required`,
      message: `Please log in to ${portalName} to continue receiving notifications.`,
      buttons: [{ title: 'Open Login Page' }],
    });

    // Handle the button click
    const clickHandler = (notifId: string, buttonIndex: number) => {
      if (notifId === `login-required-${portal}` && buttonIndex === 0) {
        chrome.tabs.create({ url: loginUrl });
        chrome.notifications.onButtonClicked.removeListener(clickHandler);
      }
    };
    chrome.notifications.onButtonClicked.addListener(clickHandler);
  } catch (err) {
    await logger.error('Failed to create login notification', {
      error: (err as Error).message,
      portal,
    });
  }
}

/**
 * Checks whether a portal is in backoff and should be skipped.
 */
export async function isPortalBackedOff(portal: PortalId): Promise<boolean> {
  const status = await storage.getPortalStatus(portal);
  if (!status.backoffUntil) return false;
  return new Date(status.backoffUntil) > new Date();
}

export { sequentialDelay };
