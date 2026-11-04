import { describe, it, expect } from 'vitest';
import { checkElmsSession, checkUcamSession, detectLoginUrl, checkSession } from './session';

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

// ─── ELMS Session ───────────────────────────────────────────────────────────

describe('checkElmsSession', () => {
  it('returns login_required when final URL is the login page', () => {
    const doc = makeDoc('<html><body><p>Welcome to ELMS</p></body></html>');
    expect(checkElmsSession(doc, 'https://elms.uiu.ac.bd/login/index.php')).toBe('login_required');
  });

  it('returns login_required when login form is present', () => {
    const doc = makeDoc(`
      <html><body>
        <form id="login">
          <input type="text" name="username" />
          <input type="password" name="password" />
          <button type="submit">Login</button>
        </form>
      </body></html>
    `);
    expect(checkElmsSession(doc, 'https://elms.uiu.ac.bd/my/')).toBe('login_required');
  });

  it('returns login_required when password input is present (generic form)', () => {
    const doc = makeDoc(
      '<html><body><input type="password" /></body></html>'
    );
    expect(checkElmsSession(doc, 'https://elms.uiu.ac.bd/my/')).toBe('login_required');
  });

  it('returns login_required when no logout link or user menu is found', () => {
    const doc = makeDoc('<html><body><div>Some content</div></body></html>');
    expect(checkElmsSession(doc, 'https://elms.uiu.ac.bd/my/')).toBe('login_required');
  });

  it('returns logged_in when logout.php link is present and URL is not login page', () => {
    const doc = makeDoc(`
      <html><body>
        <div class="usermenu">
          <a href="/user/profile.php">Profile</a>
          <a href="/login/logout.php?sesskey=xyz">Log out</a>
        </div>
        <div class="course-content">...</div>
      </body></html>
    `);
    expect(checkElmsSession(doc, 'https://elms.uiu.ac.bd/my/')).toBe('logged_in');
  });

  it('returns logged_in when user menu element is present', () => {
    const doc = makeDoc(`
      <html><body>
        <div class="usermenu">
          <span>Student Name</span>
        </div>
      </body></html>
    `);
    expect(checkElmsSession(doc, 'https://elms.uiu.ac.bd/my/')).toBe('logged_in');
  });
});

// ─── UCAM Session ────────────────────────────────────────────────────────────

describe('checkUcamSession', () => {
  it('returns login_required when final URL is the UCAM login page', () => {
    const doc = makeDoc('<html><body><p>UCAM</p></body></html>');
    expect(
      checkUcamSession(doc, 'https://ucam.uiu.ac.bd/Security/LogIn.aspx')
    ).toBe('login_required');
  });

  it('returns login_required when password input is present', () => {
    const doc = makeDoc(`
      <html><body>
        <form method="POST">
          <input type="text" name="username" />
          <input type="password" name="password" />
        </form>
      </body></html>
    `);
    expect(checkUcamSession(doc, 'https://ucam.uiu.ac.bd/Home.aspx')).toBe('login_required');
  });

  it('returns login_required when no logout link found', () => {
    const doc = makeDoc('<html><body><div>UCAM content without logout</div></body></html>');
    expect(checkUcamSession(doc, 'https://ucam.uiu.ac.bd/Home.aspx')).toBe('login_required');
  });

  it('returns logged_in when logout link is present and URL is not login page', () => {
    const doc = makeDoc(`
      <html><body>
        <div class="header">
          <a href="/Security/LogOut.aspx">Logout</a>
          <span>Welcome, Student</span>
        </div>
        <div class="content">...</div>
      </body></html>
    `);
    expect(checkUcamSession(doc, 'https://ucam.uiu.ac.bd/Home.aspx')).toBe('logged_in');
  });
});

// ─── URL detection ───────────────────────────────────────────────────────────

describe('detectLoginUrl', () => {
  it('detects ELMS login page URL (case-insensitive)', () => {
    expect(detectLoginUrl('https://elms.uiu.ac.bd/login/index.php', 'elms')).toBe(true);
    expect(detectLoginUrl('https://elms.uiu.ac.bd/LOGIN/INDEX.PHP?reason=session', 'elms')).toBe(true);
  });

  it('does not flag ELMS non-login URLs', () => {
    expect(detectLoginUrl('https://elms.uiu.ac.bd/my/', 'elms')).toBe(false);
    expect(detectLoginUrl('https://elms.uiu.ac.bd/course/view.php?id=1', 'elms')).toBe(false);
  });

  it('detects UCAM login page URL', () => {
    expect(detectLoginUrl('https://ucam.uiu.ac.bd/Security/LogIn.aspx', 'ucam')).toBe(true);
    expect(detectLoginUrl('https://ucam.uiu.ac.bd/security/login.aspx', 'ucam')).toBe(true);
  });

  it('does not flag UCAM non-login URLs', () => {
    expect(detectLoginUrl('https://ucam.uiu.ac.bd/Home.aspx', 'ucam')).toBe(false);
  });
});

// ─── Generic wrapper ─────────────────────────────────────────────────────────

describe('checkSession', () => {
  it('dispatches correctly to ELMS checker', () => {
    const doc = makeDoc('<html><body><div class="usermenu"><a href="/login/logout.php">Logout</a></div></body></html>');
    expect(checkSession('elms', doc, 'https://elms.uiu.ac.bd/my/')).toBe('logged_in');
  });

  it('dispatches correctly to UCAM checker', () => {
    const doc = makeDoc('<html><body><a href="/Security/LogOut.aspx">Logout</a></body></html>');
    expect(checkSession('ucam', doc, 'https://ucam.uiu.ac.bd/Home.aspx')).toBe('logged_in');
  });
});
