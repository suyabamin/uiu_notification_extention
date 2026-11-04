# SECURITY (Mandatory)

## 1. Assets to Protect
- University account session (cookies), and password if ever stored.
- Student personal/academic data (ID, courses, grades, dues).
- Integrity of the extension (no code injection).

## 2. Threats and Mitigations
| Threat | Mitigation |
|--------|-----------|
| Password theft | **Default: never store passwords.** Use existing browser session. |
| Malicious HTML from a compromised/XSS portal page | Parse with `DOMParser` in offscreen doc; never use `innerHTML`/`dangerouslySetInnerHTML`; render as text; sanitize URLs (allow only `https:` and allow-listed hosts) before opening or linking. |
| Remote code execution | Strict CSP, no remote scripts, no `eval`, bundle all dependencies and fonts locally. |
| Data exfiltration | No network access beyond the two portal hosts. No analytics. Lint rule/test that greps built output for unexpected URLs. |
| Over-broad permissions | Only permissions listed in `AGENTS.md`. No `<all_urls>`, no `tabs`, no `history`, no `webRequest`. |
| Malicious message senders | Validate `sender.id`; Zod-validate all messages; no `externally_connectable`. |
| Supply-chain attack | Pin dependency versions, commit `pnpm-lock.yaml`, run `pnpm audit`, keep dependency count small, review new deps. |
| Account lockout / abuse detection | Read-only GET requests, ≥10 min interval, jitter, sequential requests, backoff on 429/5xx. |
| Local data exposure | Store only compact snapshots (titles, URLs, hashes, timestamps). No full HTML, no cookies, no tokens. "Clear all data" button. |
| Phishing via notification click | Click opens only URLs that pass the allow-list check. |
| Sensitive data on lock screen | Setting "Hide details in notifications" (generic text such as "New grade posted" without the grade value). Grades value never shown in notification by default. |

## 3. Authentication Policy
**Mode A (default, recommended): Session reuse.**
- User logs in normally in the browser. Extension uses `credentials: "include"`.
- On expiry, show "Login required" and open the login page. No credentials handled.

**Mode B (optional, OFF by default, with explicit warning): Auto-login.**
Only implement if the user insists, in a late phase, with these rules:
- Requires explicit opt-in screen with a risk explanation.
- Encrypt credentials with WebCrypto AES-GCM using a key derived (PBKDF2, ≥310k iterations) from a **user-chosen master passphrase**. Never store the passphrase. Unlock into `chrome.storage.session` (memory only) per browser session.
- Never log credentials. Never send them anywhere except the portal's login form via POST to the portal origin.
- Provide "Delete credentials" button.
- Note: university may not allow automated login (check policy); CAPTCHA or MFA will break it. Prefer Mode A.

## 4. Secure Coding Checklist
- [ ] CSP set; no inline scripts/styles that need `unsafe-inline` (use Tailwind compiled CSS).
- [ ] All fetch URLs pass `isAllowedUrl()` (https, host allow-list, no credentials in URL).
- [ ] Redirect target re-validated against allow-list.
- [ ] Zod validation for storage reads, messages, and parser outputs.
- [ ] No sensitive values in logs, error messages, or notifications text (unless user opts in).
- [ ] `pnpm audit` clean, lockfile committed.
- [ ] Built bundle scanned: no `eval`, no remote URLs other than allow-list.
- [ ] Permissions diff reviewed before each release.

## 5. Privacy Statement (include in the extension's options page)
"All data stays on your device. UIU Notifier talks only to ucam.uiu.ac.bd and elms.uiu.ac.bd using your existing login. It does not collect, transmit, or share any information."

## 6. Acceptable Use
- For the student's own account only.
- Respect university IT policy and rate limits.
- Not a tool for bypassing access controls or harvesting other users' data.
