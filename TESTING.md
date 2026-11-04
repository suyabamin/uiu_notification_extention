# TESTING

## 1. Pyramid
| Level | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | diff, hashing, normalization, URL validation, backoff, quiet hours, storage migrations, every parser (fixtures) |
| Component | Vitest + Testing Library | popup/dashboard components, i18n, states |
| E2E | Playwright (Chromium, persistent context with extension loaded) | full cycle against a **mock portal server** |
| Manual | Chrome + Edge | real-login smoke test |

## 2. Mock Portal Server (`tests/mock-portal/`)
Small Node server serving fixture HTML under fake `elms` / `ucam` hosts (map via host rules or test-only host allow-list override). Features: toggle logged-in/out, mutate fixtures (add material, change due date, new notice), return 429/500/timeouts on demand.

## 3. Critical Test Cases
**Diff**
- First run → no notifications (baseline).
- New item → `added`; edited item → `modified` with correct `details`; hidden→visible → `added`.
- Parser returns empty unexpectedly → `PARSER_SUSPECT`, no mass "removed".
- Duplicate emission prevented.

**Session**
- Redirect to login → `login_required`, single warning per 6 h.
- Session returns mid-cycle → recovers next cycle.

**Network**
- 429 → 1 h backoff; 5xx → retry with backoff; timeout handled; one portal failing doesn't block the other.

**Notifications**
- Quiet hours suppress popups but update badge; snooze works; >5 changes → summary; click opens correct URL and marks read; hide-details hides grade value.

**Security**
- `isAllowedUrl` rejects `http:`, other hosts, `javascript:`, `data:`, userinfo URLs, lookalike hosts (`elms.uiu.ac.bd.evil.com`).
- Malicious HTML fixture (script tags, `onerror`, javascript links) → rendered as plain text, no execution.
- Messages from foreign senders rejected.
- Built bundle contains no `eval`, no URLs outside allow-list.
- Logs contain no cookies/tokens.

**UI**
- Keyboard-only flows, axe has zero serious violations, Bangla text not clipped, dark mode contrast.

## 4. Release Checklist
- [ ] All tests green on CI.
- [ ] Manual test on Chrome and Edge with real accounts: baseline silent, real new item detected, logout/login flow.
- [ ] Permissions identical to `ARCHITECTURE.md` manifest.
- [ ] `pnpm audit` clean.
- [ ] Version bump + CHANGELOG.
- [ ] Zip built via `pnpm zip:chrome` and `pnpm zip:edge`.
