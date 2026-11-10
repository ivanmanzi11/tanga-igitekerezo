# Tanga Igitekerezo — Digital Agasanduku k'Ibitekerezo

A full digital suggestion & feedback management system for institutions —
built on the same stack you used for TransConnect (React + Django REST
Framework + SimpleJWT + PostgreSQL/SQLite), so it builds on skills you
already have rather than a new stack.

It is a genuine workflow system, not a form-to-database dump:

```
Citizen/Employee → Submit → Categorize → Review → Assign → Respond → Track → Close
```

## Example flow

1. Ivan submits a suggestion anonymously.
2. He receives tracking code `TGK-2026-00127`. Status: **Received**.
3. An officer reviews it and assigns it to the ICT department.
4. ICT marks it **Under Review**, then responds.
5. Status becomes **Resolved**.
6. Ivan enters `TGK-2026-00127` on the Track page and sees the response —
   no account, no login, ever required.

## Privacy model

Every submission is one of three types, enforced at the API layer (not just hidden in the UI):

| Type | Identity stored? | Who can see it? |
|---|---|---|
| **Anonymous** | No | Nobody — the fields are never populated |
| **Confidential** | Yes | Only an admin, the target department's head, or the officer actually assigned to it |
| **Identified** | Yes | Any staff handling the submission |

## Roles

- **Citizen / Employee** — submits and tracks; no staff access.
- **Officer** — sees submissions assigned to them or their department; can review, respond, change status.
- **Department Head** — everything an officer can do, plus assigning submissions within their department.
- **Administrator** — full access, manages departments/categories/staff accounts, sees analytics for the whole institution.

## Project layout

```
tanga-igitekerezo/
├── backend/                 Django REST API
│   ├── accounts/            Users, roles, departments, JWT auth
│   ├── submissions/         Categories, submissions, assignments, responses, status history
│   ├── notifications/       In-app notifications (assignment, response, status change)
│   ├── common/               Shared role-based permission classes
│   └── tanga_igitekerezo/   Project settings/urls
└── frontend/                React (Vite) app
    ├── src/pages/           Home, Submit, Track, Login, StaffDashboard, SubmissionDetail, Analytics
    ├── src/components/      TopNav, StaffLayout, StatusBadge
    └── src/context/         Auth (JWT + auto-refresh)
```

## Running it locally

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # edit if you want PostgreSQL instead of SQLite
python manage.py migrate
python manage.py seed_data      # creates departments, categories, and an admin account
python manage.py runserver
```

The seed command prints an admin login (`admin` / `ChangeMe123!`) — **change
this password immediately**, e.g. via `/admin/` or the Django shell.

To use PostgreSQL instead of the SQLite default, set `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `DB_HOST`, `DB_PORT` in `.env` before migrating.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # points to http://localhost:8000/api by default
npm run dev
```

Visit `http://localhost:5173`.

## Key API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register/` | Public sign-up (citizen/employee) |
| POST | `/api/auth/login/` | JWT login |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/categories/`, `/api/departments/` | Public reference data |
| POST | `/api/submissions/` | Create a submission (public) |
| GET | `/api/track/{tracking_code}/` | Public status + response lookup |
| GET | `/api/submissions/` | Staff list, scoped to role/department, filterable |
| GET | `/api/submissions/{id}/` | Full staff detail (identity respects confidentiality rules) |
| POST | `/api/submissions/{id}/assign/` | Route to a department/officer |
| POST | `/api/submissions/{id}/set_status/` | Move through Received → … → Closed |
| POST | `/api/submissions/{id}/respond/` | Write a response / request more info |
| POST | `/api/submissions/{id}/attachments/` | Attach a file |
| GET | `/api/analytics/summary/` | Totals, unresolved count, avg. resolution time, breakdowns |

Departments, categories, and staff accounts can also be managed through the
built-in Django admin at `/admin/` — the fastest path for day-to-day
administration without building extra screens.

## What's built vs. what's next

Four rounds of work are in this codebase: the original core system, and
three refinement passes based on detailed feedback and design references.

**A critical bug fixed this round:** every earlier test of "identified"
or "confidential" submissions happened to run as an unauthenticated
request, which hid a real crash — creating such a submission *while
signed in* triggered a 500 error in the notification signal
(`get_new_status_display()` doesn't exist on `StatusHistory`), which
rolled back the entire submission inside its transaction. This is now
fixed and verified with a full authenticated create → assign → respond →
resolve chain, confirming every notification fires correctly along the
way. If you deployed an earlier version of this app, this is worth
pulling immediately — it affected any signed-in citizen or staff member
submitting anything other than "anonymous."

**Round 4 additions, informed by two documents you provided — a punch
list and a real institutional PDF report as a formatting reference:**

- **PDF reports**, styled after the reference you gave (letterhead, boxed
  metadata badges, blue divider, structured tables) — now the default
  format alongside CSV/Excel/Word for all three report types. One
  clarification: the reference was an actual Ministry of Justice
  document, so I replicated the *layout* (badges, tables, letterhead
  structure) but kept **Tanga Igitekerezo's own name and the national
  coat of arms** rather than the ministry's letterhead — this system
  isn't operated by that ministry, so it shouldn't claim to be.
- **Fixed the duplicate-header bug**: the public site header was
  rendering above the staff portal's own top bar on every signed-in page.
  It's now conditional on whether you're in the staff area.
- **Fixed the "two settings pages" bug**: `Settings.jsx` and
  `ChangePassword.jsx` had both ended up as duplicate hub pages from an
  earlier rename, and the actual password-change form had gone missing
  entirely — which is exactly why "change password isn't working" showed
  up in your notes. Rebuilt as one consolidated Settings hub plus a
  working password form, with back buttons throughout.
- **Submissions and Dashboard are now separate.** Dashboard shows the
  greeting banner, stats, and quick actions; "Submissions" is its own
  page with the full filterable, paginated table.
- **Pagination** (Next/Previous) on the submissions table.
- **Sidebar polish**: the collapse toggle moved to the top next to the
  logo, with a small Rwanda emblem next to "Overview"; the top nav's logo
  and name are now vertically centered together.
- **Citizens can now create their own accounts** (`/signup`) — no admin
  approval needed, unlike staff sign-up. They get a "My Submissions" page
  showing everything they've submitted while signed in, with tracking
  codes. Anonymous submissions still never link to any account, signed in
  or not.
- **Notifications are clickable** — opening one marks it read and jumps
  to the relevant case.
- **Permission groups can now be edited**: rename a group, change its
  permissions, and add/remove/transfer members from a dedicated group
  page, not just created once via the API.

**Re-verified, not re-fixed:** your notes flagged "responded/needs_info
cases being closed" as still broken. I traced the logic again and tested
it directly — a case backdated 10 days while in `needs_info` stayed in
`needs_info` after running the auto-close job; only `resolved` cases are
ever eligible for auto-close. I couldn't reproduce the reported bug from
the current code, so if you're still seeing it, it'd help to know exactly
which action preceded it.

**Declined again, for the same reason as before:** presenting this system
as based on or connected to MINIJUST. I used the coat of arms (Rwanda's
national symbol, not a specific ministry's) and matched the *visual
structure* of the report you shared, but didn't add ministry branding or
claim a government affiliation the system doesn't have.

Natural next steps:

1. **Full translation coverage** — still the single biggest gap; the
   switcher works but only translates navigation, the homepage, and the
   footer.
2. **Wire permission groups into enforcement** — they're fully editable
   now, but still organizational rather than checked by the API.
3. **A more complete AI layer** — the punch list describes something
   considerably more elaborate (auto-thanking submitters, grouping
   similar cases into one respondable unit) than the FAQ widget and
   similarity-clustering view built so far. Worth scoping as its own
   focused piece of work.
4. **Real-time chat** via WebSockets (Django Channels, already in your
   TransConnect stack) for the internal/owner conversation threads.
5. **Email/SMS notifications**, **deadlines & escalation**, and **audit
   logs for user/department/category changes** — all still open from
   previous rounds.

Given how much ground the last few rounds have covered, I'd genuinely
recommend picking the next 2-3 items together rather than another full
sweep — happy to go deep on whichever matters most.


## Recent changes (Admin 2 / General 2 tracker)

- **Priority levels (ADM_01)** — cases are High, Medium or Low. The AI sets it from keyword lists an admin manages
  under *Priority keywords* (`/staff/priority`); High words win over Medium; everything else is Low. Run
  `python manage.py seed_data` for starter keywords. Old `normal`/`urgent` values are migrated to `low`/`high`.
- **Visibility by priority (ADM_02)** — High: admins only. Medium: admins + the Head of Department of the case's
  department. Low: all staff in that department. Applied to lists, case pages, case groups, analytics, dashboard and reports
  (`backend/common/visibility.py`).
- **Case groups (GEN_01)** — staff working a case (assignee, assigner, department colleagues, department head) can open its
  group from the chat icon and from the case page, not just admins.
- **Message actions (GEN_02)** — every internal message has a ▾ menu: reply, edit, delete, pin (`ChatPanel.jsx`).
- **AI assistant (GEN_03)** — answers from FAQs; otherwise forwards the question to staff with the new
  *can answer assistant questions* permission and gives the asker a reference code. Answers appear in the assistant and can be
  saved as FAQs (`/staff/assistant-questions`).
- **Content, animations, images (GEN_04–06)** — new Home/About copy with a paper-box comparison, scroll/float/shine animations,
  and the supplied illustrations.

After pulling these changes run `python manage.py migrate`. Give the new permission to the groups that should answer
assistant questions (Permission groups page); admins always have it.


## Round 2 changes (Admin 2 / General 2 — second tracker)

**Run after pulling:** `pip install -r requirements.txt` (backend), `python manage.py migrate`, `python manage.py seed_data`,
and in `frontend/`: `npm install` (new dependency `qrcode.react`) then `npm run dev`.

- **ADM_01 Priority permissions** — three new permissions in every permission group: *can see and work on High / Medium / Low
  (unmarked) priority cases*. Existing groups are migrated so nothing breaks (everyone keeps Low, department-head level gets Medium,
  administrators get all). Visibility is now `common/visibility.py`: priority permission + the usual reach (department / assigned).
- **ADM_02 Last admin** — the only active admin can't be disabled, deleted or have their role changed (API + clear message in the UI).
- **GEN_01 Reports** — PDF tables span the page and start at the left margin, wrapped cells, zebra rows, footer with page numbers,
  period shown on the report; Excel exports get a styled header, filters and frozen headers.
- **GEN_02 Anonymous while signed in** — the tracking code is saved to the account (`SavedTrackingCode`) and appears under
  My submissions. The submission itself still stores no identity and staff screens never read that table.
- **GEN_03 Scroll to top** on every page change.
- **GEN_04 Languages** — the whole interface translates through `frontend/src/i18n/dictionary.part*.js` (one row per text:
  English, Kinyarwanda, French). To correct a translation, edit its row. In the browser console, `__tgkMissingStrings()` lists
  texts on screen that still need a row. The assistant answers in the asker's language.
- **GEN_05 Menu dropdowns** — Overview / Case Management / Administration / Account fold open and closed (remembered).
- **GEN_06 Assistant** — TF-IDF retrieval over staff FAQs + a built-in English/Kinyarwanda/French knowledge base, live tracking-code
  and statistics answers, suggestion chips, thumbs up/down feedback that re-ranks answers, unanswered questions forwarded to staff.
- **GEN_07 Avg. resolution (hrs)** — now counts resolved cases (not only closed ones).
- **GEN_08 Ways to access** — new `/access` page: real QR code (main) with download, and USSD `*502#` (additional) with the
  supplied illustrations; teaser on Home, links in menu/footer/submit page. Set `VITE_PUBLIC_URL` (the public site address, used
  inside the QR code) and `VITE_USSD_CODE` in `frontend/.env` for production.
- **GEN_09 Report period** — "Choose a period…" with from / to dates for cases and analytics exports.


## Round 3 changes (Admin 3 / General 3)

**Run after pulling:** `pip install -r requirements.txt`, `python manage.py migrate`, `python manage.py seed_data`, then in `frontend/`:
`npm install` and `npm run dev`. (Migration `submissions.0010` turns the old "Idea" category into "Others" and removes the
account-to-anonymous-case link table.)

- **ADM_01 Departments** — `/staff/departments`: create, edit, delete; open a department to read every member. A department that still
  has staff can't be deleted; one with past cases is archived so those cases keep it.
- **ADM_02 Assistant & FAQs** — `/staff/assistant-questions` now has Waiting / Answered / FAQ entries / Built-in topics. Admins add,
  edit, switch off and delete FAQ entries (with Kinyarwanda and French versions), delete or re-answer forwarded questions, and
  "Customise" any built-in topic. The assistant uses every change on the next question.
- **ADM_03 Categories** — `/staff/categories`: view, add, edit, delete. Deleting or renaming a category that has submissions archives
  the old one, so history and statistics keep the name they were filed under; new submissions use the new name.
- **ADM_04 Others** — "Idea" became **Others** everywhere, always listed after every other category and not deletable.
- **GEN_01 Cross-platform** — responsive from 320 px: hamburger menu, slide-in staff drawer, touch-sized controls, 16 px fields (no
  iPhone zoom), notch safe areas, full-width chat sheets, scrollable tables; installable on a phone's home screen (web app manifest,
  icons, theme colour).
- **GEN_02 Tracking codes** — `TGC-YYYY-MM-DD-NNNN` (random 0001–9999 per case; only if a day ever uses all 9999 does it widen to
  5 digits). Old `TGK-…` codes keep working. Lookups are case-insensitive and rate-limited (40/min) so codes can't be guessed.
- **GEN_03 Anonymous first** — admins switch Confidential and Identified on/off under Settings → "Ways of submitting"
  (`/api/submission-options/`); anonymous is always on and preselected. Both are on by default — turn them off there.
- **GEN_04 Real anonymity** — an anonymous case is never linked to an account (even if signed in): identity fields are forced empty,
  the browser doesn't send the login token, the server drops IP / browser / referrer before handling the request, photos are
  re-encoded without EXIF/GPS and all files are renamed. The old account-to-code link table was deleted; codes for anonymous cases
  are now remembered only in the person's own browser (My submissions → "on this device").
  Also run gunicorn with `--access-logfile /dev/null` in production so the web server doesn't log IP addresses.


## Round 4 changes (General 2 sheet)

- **GEN_01 / GEN_02 / GEN_07 Phones & tablets** — compact public header (logo and name smaller; language and dark/light
  buttons move to the footer on phones), staff header rebuilt as one tidy row (menu · brand · icon buttons), smaller type,
  cards and buttons, tables turn into stacked cards, images shrink and sit beside their text, a redesigned phone footer.
  The website finds the backend from the address it was opened at, the backend accepts local-network origins in development and
  now reads `backend/.env`, and `start-dev.ps1` starts everything for phones. See `DEPLOYMENT.md` for the institutional (HTTPS) setup.
- **GEN_03 Buttons** — buttons are coloured by purpose: green = save/add, blue = view/download/export, gold = edit,
  red = delete/remove, deep green = main action.
- **GEN_04 Header** — logo and system name now live in the sticky header; the page title is part of the page and scrolls. The
  collapse/expand button stays at the top of the menu and uses the rounded-square menu icon.
- **GEN_05 Departments** — adding a department asks only for a name and an optional description (categories unchanged).
- **GEN_06 Uploading** — attaching and sending a file shows a rounded loading bar ("Uploading…") filled with the real percentage,
  on the Submit page, Track replies and staff responses; the drop zone uses a file-upload icon.


## Round 5 changes (General 2 sheet — phone polish)

- **GEN_01 / GEN_02** — on phones the staff header holds only the logo, the full system name, notifications and the profile avatar;
  the menu button sits in a slim bar just below it, together with the dark/light, language and conversations buttons. The public
  header shows the full name too. Desktop is unchanged.
- **GEN_03** — charts on the Analytics page are one per row and taller on phones.
- **GEN_04** — buttons size to their words on phones instead of stretching across the screen.
- **GEN_05** — the opened menu fills the whole screen height and the page behind it can't scroll.
- **GEN_06** — pictures stay beside their words on phones (smaller), instead of dropping below them.
- **GEN_07** — wider side margins on phones.
- **GEN_08** — the current page stays clearly highlighted (green with a gold edge) in the phone menu.
- **GEN_09** — the menu icon opens *and* closes the menu (it turns into a cross), and the menu also has a "Close menu" button.


## Round 6 changes (General 2 sheet)

- **GEN_01** — on phones the "Privacy stays yours to choose" words and the "Example" card start at the left margin, with the small
  picture to their right (the words wrap around it).
- **GEN_02** — the second bar on phones (menu button, dark/light, language, conversations) now slides away after 3 seconds without
  touching the screen and returns as soon as you touch, scroll, tap or type; it then hides again after 3 quiet seconds. It stays while
  the menu or one of its pop-ups is open. The page title is shown in the page itself.
- **GEN_03** — footer contact details are now `info@minijust.gov.rw` and `3936` (the assistant gives the same details).
