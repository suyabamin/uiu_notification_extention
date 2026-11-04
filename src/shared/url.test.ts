import { describe, it, expect } from 'vitest';
import { isAllowedUrl, resolvePortalUrl } from './url';

describe('isAllowedUrl', () => {
  it('accepts valid ELMS and UCAM HTTPS URLs', () => {
    expect(isAllowedUrl('https://elms.uiu.ac.bd/')).toBe(true);
    expect(isAllowedUrl('https://elms.uiu.ac.bd/my/courses.php')).toBe(true);
    expect(isAllowedUrl('https://elms.uiu.ac.bd/course/view.php?id=1234&section=2')).toBe(true);
    expect(isAllowedUrl('https://ucam.uiu.ac.bd/Security/LogIn.aspx')).toBe(true);
    expect(isAllowedUrl('https://ucam.uiu.ac.bd/Student/NoticeBoard.aspx')).toBe(true);
    expect(isAllowedUrl('https://ucam.uiu.ac.bd:443/Home.aspx')).toBe(true);
  });

  it('rejects HTTP (non-secure) URLs', () => {
    expect(isAllowedUrl('http://elms.uiu.ac.bd/')).toBe(false);
    expect(isAllowedUrl('http://ucam.uiu.ac.bd/Security/LogIn.aspx')).toBe(false);
  });

  it('rejects other hosts even if secure or related', () => {
    expect(isAllowedUrl('https://uiu.ac.bd/')).toBe(false);
    expect(isAllowedUrl('https://www.uiu.ac.bd/')).toBe(false);
    expect(isAllowedUrl('https://google.com/')).toBe(false);
    expect(isAllowedUrl('https://moodle.org/')).toBe(false);
  });

  it('rejects lookalike / subdomain suffix attack URLs', () => {
    expect(isAllowedUrl('https://elms.uiu.ac.bd.evil.com/')).toBe(false);
    expect(isAllowedUrl('https://ucam.uiu.ac.bd.attacker.org/login')).toBe(false);
    expect(isAllowedUrl('https://fake-elms.uiu.ac.bd/')).toBe(false);
    expect(isAllowedUrl('https://subdomain.elms.uiu.ac.bd/')).toBe(false);
    expect(isAllowedUrl('https://elms.uiu.ac.bd@evil.com/')).toBe(false);
  });

  it('rejects userinfo (embedded credentials)', () => {
    expect(isAllowedUrl('https://user:pass@elms.uiu.ac.bd/')).toBe(false);
    expect(isAllowedUrl('https://admin@ucam.uiu.ac.bd/Home.aspx')).toBe(false);
  });

  it('rejects dangerous protocols (javascript, data, vbscript, file)', () => {
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedUrl('javascript://elms.uiu.ac.bd/')).toBe(false);
    expect(isAllowedUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedUrl('file:///C:/Windows/System32/calc.exe')).toBe(false);
  });

  it('rejects non-standard ports', () => {
    expect(isAllowedUrl('https://elms.uiu.ac.bd:8080/')).toBe(false);
    expect(isAllowedUrl('https://ucam.uiu.ac.bd:8443/login')).toBe(false);
  });

  it('rejects empty, null, undefined, or malformed inputs', () => {
    expect(isAllowedUrl('')).toBe(false);
    expect(isAllowedUrl('   ')).toBe(false);
    expect(isAllowedUrl(null as unknown as string)).toBe(false);
    expect(isAllowedUrl(undefined as unknown as string)).toBe(false);
    expect(isAllowedUrl('not-a-valid-url')).toBe(false);
    expect(isAllowedUrl('https://')).toBe(false);
  });
});

describe('resolvePortalUrl', () => {
  it('resolves valid relative paths against portal base', () => {
    const resolved = resolvePortalUrl('/my/courses.php', 'https://elms.uiu.ac.bd');
    expect(resolved).toBe('https://elms.uiu.ac.bd/my/courses.php');
  });

  it('resolves valid relative paths with query parameters', () => {
    const resolved = resolvePortalUrl('view.php?id=123', 'https://elms.uiu.ac.bd/course/');
    expect(resolved).toBe('https://elms.uiu.ac.bd/course/view.php?id=123');
  });

  it('rejects resolution resulting in an unapproved host', () => {
    const resolved = resolvePortalUrl('https://evil.com/phish', 'https://elms.uiu.ac.bd');
    expect(resolved).toBeNull();
  });

  it('rejects javascript: URLs when resolving', () => {
    const resolved = resolvePortalUrl('javascript:alert(1)', 'https://elms.uiu.ac.bd');
    expect(resolved).toBeNull();
  });
});
