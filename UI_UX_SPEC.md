# UI / UX SPEC (Frontend)

## 1. Design Principles
- Clean, calm, student-friendly. Information first, minimal chrome.
- Fast: popup renders from cached state in < 100 ms.
- Accessible: WCAG 2.1 AA, full keyboard support, visible focus rings, ARIA labels, respects `prefers-reduced-motion`.
- Bilingual: English and বাংলা, language switch applies instantly. Use `Noto Sans Bengali` bundled locally (no Google Fonts CDN).
- Light / Dark / System themes via CSS variables.

## 2. Design System
| Token | Light | Dark |
|-------|-------|------|
| `--bg` | #F8FAFC | #0F172A |
| `--surface` | #FFFFFF | #1E293B |
| `--text` | #0F172A | #F1F5F9 |
| `--muted` | #64748B | #94A3B8 |
| `--primary` | #2563EB | #60A5FA |
| `--success` | #16A34A | #4ADE80 |
| `--warning` | #D97706 | #FBBF24 |
| `--danger` | #DC2626 | #F87171 |
| ELMS accent | #7C3AED | #A78BFA |
| UCAM accent | #0891B2 | #22D3EE |

- Radius 12px cards, 8px controls. Spacing scale 4/8/12/16/24. Font: Inter (local) + Noto Sans Bengali.
- Icons: `lucide-react`. Source badges: "ELMS" (purple), "UCAM" (cyan).
- Components (build in `ui/components`): Button, IconButton, Card, Badge, Chip, Toggle, Select, Tabs, Dialog, Toast, Tooltip, EmptyState, Skeleton, Spinner, SearchInput.

## 3. Surfaces

### 3.1 Popup (400 × 560 px)
```
┌──────────────────────────────────────┐
│ UIU Notifier         [↻] [🔕] [⚙]    │  header: check now, snooze, open dashboard
├──────────────────────────────────────┤
│ ELMS ● Connected · 5 min ago         │  status pills (click login pill → opens login)
│ UCAM ● Login required  [Log in]      │
├──────────────────────────────────────┤
│ [All] [Unread 4] [ELMS] [UCAM]       │  tabs / chips
├──────────────────────────────────────┤
│ ▌📄 CSE 2213 · New material          │  ▌ = priority color bar; bold = unread
│    Lecture 5 slides.pdf    · 10m ago │
│ ▌📢 UCAM · New notice                │
│    Final exam schedule     · 1h ago  │
│ ▌📝 CSE 3411 · Due date changed      │
│    Assignment 2 · Fri → Sun · 3h ago │
│ ...                                  │
├──────────────────────────────────────┤
│ [Mark all read]        [Open dashboard] │
└──────────────────────────────────────┘
```
- Click item → opens URL in new tab, marks read.
- Hover actions: mark read, mute this course, open.
- "Check now" shows spinner; result toast ("2 new updates" / "Up to date").
- Empty state: friendly illustration + "You're all caught up".
- Error state: portal-specific message with action button.

### 3.2 Dashboard (full tab page)
Left sidebar: **Notifications**, **Courses**, **Watched Pages**, **Settings**, **Diagnostics**, **About & Privacy**.

**Notifications:** infinite list with filters (portal, type, course, priority, read/unread, date range), search, bulk mark read, group-by-day headers. Detail drawer shows `details` (from → to) and text diff for watched pages.

**Courses:** list of ELMS courses with toggle per course (watch / mute), last updated time, item counts.

**Watched Pages:** add URL + optional CSS selector + label; test button ("Fetch now and preview extracted text"); list with last change time.

**Settings:**
- General: interval, language, theme, sound.
- Notifications: type toggles per portal, quiet hours, hide-details toggle, test notification button.
- Data: export/import settings, clear history, clear all data (confirm dialog).
- Advanced (collapsed): backoff status, parser versions.

**Diagnostics:** per-portal status, last 50 log lines, "Run parser test" button showing item counts per parser and warnings, "Copy diagnostic report" (sanitized).

**About & Privacy:** privacy statement, permissions explanation, version.

### 3.3 Onboarding (first-run tab)
Steps with progress indicator:
1. Welcome + privacy promise (no passwords stored, data stays local).
2. "Log in to your portals" — two cards with "Open ELMS login" / "Open UCAM login" and live status detection (poll status every few seconds).
3. Choose what to watch (types, courses auto-loaded after ELMS login).
4. Notification preferences + "Send test notification" (request permission if needed).
5. "Building your baseline…" progress, then done. Explain that the first scan is silent.

### 3.4 Native Notifications
- Title: `ELMS · CSE 2213`; message: `New material: Lecture 5 slides.pdf`.
- Buttons (where supported): "Open", "Mark read". Click → open URL.
- Summary notification when > 5 changes.
- Optional sound via offscreen audio (reason `AUDIO_PLAYBACK`) if `sound` enabled.

### 3.5 Toolbar Badge
- Count of unread (cap "99+"). Color: red for high-priority unread, blue otherwise. Gray "!" when login required.

## 4. States Checklist (every screen)
Loading (skeleton) · Empty · Error · Offline · Login required · Parser suspect warning banner · Snoozed banner · Quiet hours banner.

## 5. Microcopy (EN / BN examples)
| Key | EN | BN |
|-----|----|----|
| `status.connected` | Connected | সংযুক্ত |
| `status.login_required` | Login required | লগইন প্রয়োজন |
| `empty.all_caught_up` | You're all caught up | সব আপডেট দেখা হয়েছে |
| `action.check_now` | Check now | এখনই চেক করুন |
| `action.mark_all_read` | Mark all read | সব পড়া হয়েছে |
| `notif.new_material` | New material | নতুন স্টাডি ম্যাটেরিয়াল |
| `notif.new_announcement` | New announcement | নতুন ঘোষণা |
| `notif.grade_posted` | New grade posted | নতুন গ্রেড প্রকাশিত |
| `notif.due_changed` | Due date changed | জমার তারিখ পরিবর্তিত |

## 6. Interaction & Performance Rules
- UI reads from `chrome.storage` + subscribes with `storage.onChanged`; no polling from UI.
- Virtualize lists > 100 items.
- Animations ≤ 200 ms; disable under reduced motion.
- No layout shift; fixed popup dimensions.

## 7. Security in UI
- All portal-derived strings rendered as text nodes only.
- Links: `rel="noopener noreferrer"`, validated with `isAllowedUrl()` before `chrome.tabs.create`.
