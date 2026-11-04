import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPortalPage, TooManyRequestsError } from './fetcher';

describe('fetchPortalPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects URLs not in the allow-list', async () => {
    await expect(fetchPortalPage('https://evil.com/steal')).rejects.toThrow(
      'URL not in allow-list'
    );
  });

  it('rejects HTTP URLs', async () => {
    await expect(fetchPortalPage('http://elms.uiu.ac.bd/')).rejects.toThrow('URL not in allow-list');
  });

  it('fetches a valid portal URL and returns HTML', async () => {
    const mockHtml = '<html><body>Logged in</body></html>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        url: 'https://elms.uiu.ac.bd/my/',
        text: async () => mockHtml,
      })
    );

    const result = await fetchPortalPage('https://elms.uiu.ac.bd/my/');
    expect(result.status).toBe(200);
    expect(result.html).toBe(mockHtml);
    expect(result.ok).toBe(true);
    expect(result.redirectedToLogin).toBe(false);
  });

  it('detects redirect to ELMS login page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        url: 'https://elms.uiu.ac.bd/login/index.php',
        text: async () => '<html><form id="login">...</form></html>',
      })
    );

    const result = await fetchPortalPage('https://elms.uiu.ac.bd/my/');
    expect(result.redirectedToLogin).toBe(true);
  });

  it('detects redirect to UCAM login page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        url: 'https://ucam.uiu.ac.bd/Security/LogIn.aspx',
        text: async () => '<html><input type="password" /></html>',
      })
    );

    const result = await fetchPortalPage('https://ucam.uiu.ac.bd/Home.aspx');
    expect(result.redirectedToLogin).toBe(true);
  });

  it('throws TooManyRequestsError on HTTP 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
        url: 'https://elms.uiu.ac.bd/my/',
        text: async () => '',
      })
    );

    await expect(fetchPortalPage('https://elms.uiu.ac.bd/my/')).rejects.toThrow(
      TooManyRequestsError
    );
  });

  it('retries on HTTP 500 and eventually throws', async () => {
    // Stub delay so backoff is instant (avoid fake timer complexity)
    vi.stubGlobal(
      'setTimeout',
      (fn: () => void, _ms: number) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
    );

    const fetchMock = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      url: 'https://elms.uiu.ac.bd/my/',
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchPortalPage('https://elms.uiu.ac.bd/my/', { maxRetries: 2, timeoutMs: 20000 })
    ).rejects.toThrow('Server error: HTTP 500');

    // 1 initial + 2 retries = 3 total calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws on redirect to disallowed external URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        url: 'https://phishing.com/steal',
        text: async () => '<html>Phish</html>',
      })
    );

    await expect(fetchPortalPage('https://elms.uiu.ac.bd/my/')).rejects.toThrow(
      'Redirect to disallowed URL'
    );
  });
});
