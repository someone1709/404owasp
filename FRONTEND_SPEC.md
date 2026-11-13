# NextUp — Frontend Spec (PS-18 Internship Tracker)

> Paste this whole file into your AI coding tool as the spec. The backend owns all logic
> (validation, deadline rules, counts, insights). The frontend renders what the API returns
> and **refetches the dashboard after every change**. That refetch is what makes judge step 3 work.

## Stack

- Vite + React + TypeScript, plain CSS or Tailwind.
- No env files, no API keys, no external fonts/CDNs, no login.
- **Already done in `frontend/`:**
  - `src/types.ts`: the contract below.
  - `src/api.ts`: a typed client for every endpoint.
  - The dev proxy.
  - A placeholder `App.tsx` that proves the backend connection works. Replace it with the real UI.
- Run it:
  - Terminal 1: `cd backend && npm run dev` (port 4100)
  - Terminal 2: `cd frontend && npm run dev`
- All requests go to a relative path (`/api/...`). Dev proxy in `vite.config.ts` (no CORS, no env):
  ```ts
  server: { proxy: { '/api': 'http://localhost:4100' } }
  ```
- In production the backend serves the built `dist/` folder, so the app has one URL.
- Don't call `fetch` yourself. Use `api.dashboard()`, `api.create(draft)`, `api.setStatus(id, status)` and the others.
  They add both headers below for you, and throw `ApiError` with `.errors` (per-field messages) on a 400.

## Judge path (must work perfectly)

1. Create an application with a deadline within 3 days. It appears at the top of the list
   with an amber **"Due in 2 days"** badge. It also shows up in Upcoming deadlines.
2. Click the **Needs action** filter. The new application is listed, with its reason shown.
3. Change its status. The pipeline summary counts update visibly (animate the number).

## Minute-40 twist (unlocked): what the UI must show

The backend already supports all of this. These are the UI pieces the judges will look for:

| Twist requirement | What to build |
|---|---|
| **Three-day warning:** flag deadlines within 3 days automatically | Cards with `action.severity === 'soon'` get an amber left border, a light amber background and the badge, with no click needed. `overdue` gets the same treatment in red. |
| **Filter showing only applications requiring action** | The **Needs action (n)** tab shows `items.filter(i => i.action.needsAction)`. Put it first after All, visually loud, with the count from `summary.needsAction`. |
| **Urgency highlighting within 72 hours** | Same as the first row. Also show the reason line ("Online test due in 2 days") on the card. |
| **Status lifecycle:** Applied, Test, Interview, Offer, Rejected | Use exactly these 5 values in the status select and summary tiles (`STATUSES` in `types.ts`). |
| **No scraping or OAuth email** | Nothing to build. Don't add "import from LinkedIn" or "connect Gmail". |
| **Editable next-action memo field** | See "Next-action memo" under the card section below. |

---

## API contract

Every request carries two things, and `src/api.ts` already adds both:

- `?today=YYYY-MM-DD`: the browser's **local** date, so the server never gets "today" wrong.
- `X-Workspace-Id: <random id>`: created once and kept in localStorage. Each browser gets its own
  copy of the demo data, so judges testing the same live link never see each other's changes.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/dashboard?today=YYYY-MM-DD` | none | `Dashboard` |
| POST | `/api/applications?today=…` | `ApplicationDraft` | `201 Application` or `400 { errors }` |
| PUT | `/api/applications/:id?today=…` | `ApplicationDraft` | `200 Application`, `400`, or `404` |
| PATCH | `/api/applications/:id/status?today=…` | `{ status }` | `200 Application` |
| PATCH | `/api/applications/:id/memo?today=…` | `{ nextActionMemo }` (`''` clears it) | `200 Application` or `400` (use `api.setMemo(id, text)`) |
| DELETE | `/api/applications/:id` | none | `200 { id }` (soft delete) |
| POST | `/api/applications/:id/restore` | none | `200 Application` (used by Undo) |
| POST | `/api/demo/reset` | none | `204` (reload the demo data) |
| DELETE | `/api/applications` | none | `204` (wipe all data) |
| GET | `/api/export.ics?today=…` | none | `text/calendar` file (use `api.downloadCalendar()`) |
| GET | `/api/health` | none | `{ ok: true }` |

After **every** POST, PUT, PATCH or DELETE, call `GET /api/dashboard` again and replace the state.

Validation errors come back as `400 { "errors": { "company": "Company is required", "link": "Only http:// or https:// links are allowed" } }`.
Show each message under its field.

### Types (copy exactly)

```ts
export type Status = 'Applied' | 'Test' | 'Interview' | 'Offer' | 'Rejected'
export type Source = 'Referral' | 'Campus' | 'Job board' | 'Company site' | 'Cold email'
export type CompanyType = 'Product' | 'Service' | 'Startup'
export type Severity = 'overdue' | 'soon' | 'stale' | 'ok' | 'closed'

export interface Application {
  id: string
  company: string
  role: string
  deadline: string                          // 'YYYY-MM-DD'
  status: Status
  history: { status: Status; at: string }[] // every status change, oldest first
  source: Source
  resumeVersion: string                     // e.g. 'v1-general', 'v2-backend'
  companyType: CompanyType
  link?: string
  notes?: string
  nextActionMemo?: string                   // the student's own next step (max 140); show it instead of action.nextStep
  createdAt: string
  action: {                                 // computed by the backend for ?today
    needsAction: boolean
    severity: Severity
    badge: string          // "Due in 2 days" | "Due today" | "Overdue by 1 day" | "No reply in 16 days" | "Due 24 Nov" | "Closed"
    reason: string | null  // why it needs action, e.g. "Online test due in 2 days"; null if nothing is urgent
    nextStep: string       // e.g. "Finish the online test"
    daysLeft: number
    urgency: number        // sort key; higher means more urgent
  }
}

export type ApplicationDraft = Pick<Application,
  'company' | 'role' | 'deadline' | 'status' | 'source' | 'resumeVersion' | 'companyType' | 'link' | 'notes' | 'nextActionMemo'>

export interface Dashboard {
  today: string
  items: Application[]   // already sorted by urgency, most urgent first
  summary: {
    counts: Record<Status, number>
    total: number
    active: number       // everything except Rejected
    needsAction: number
  }
  deadlines: {           // active only: overdue items plus the next 14 days, soonest first
    id: string; company: string; role: string
    deadline: string; daysLeft: number; severity: Severity
  }[]
  insights: {
    funnel: { stage: 'Applied' | 'Test' | 'Interview' | 'Offer'; count: number; pct: number }[]
    messages: { tone: 'warn' | 'good' | 'info'; text: string; tip?: string }[]
  }
}
```

**Before the backend is ready:** make `src/api.ts` return a hard-coded `Dashboard` object with about 8 fictional items.
Keep the same function signatures, then switch to `fetch` once `/api/dashboard` is up.

---

## Screens and components

### 1. Header
- App name, today's date ("Friday, 13 November"), and a big **+ New application** button.
- A one-line summary under the date: **"4 applications need your attention"** (from `summary.needsAction`).
- A privacy chip that reads "🔒 Demo data · no accounts · no tracking".
- An overflow menu with: Export deadlines (.ics), Reset demo data, and Wipe all data (ask to confirm first).

### 2. Pipeline summary (required)
- One tile per status (Applied, Test, Interview, Offer, Rejected) showing its count, plus a thin stacked bar of the proportions.
- Clicking a tile filters the list to that status.
- Animate the count when it changes. A quick way: put `key={count}` on the number span with a CSS pop/flash animation. **This is judge step 3, so make it obvious.**

### 3. Filter bar
- Tabs: **All**, **Needs action (n)** (visually prominent, with an amber dot), then each status.
- A search box that matches company or role. Filtering happens on the client because the list is small.
- An empty "Needs action" view shows "You're all caught up ✓".

### 4. Application card (one per item)
- Company in bold, then role.
- Small chips for source, resume version and company type.
- **Deadline badge** from `action.badge`, coloured by `action.severity`:
  - `overdue`: red
  - `soon`: **amber** (this is the judge's "warning badge")
  - `stale`: blue
  - `ok`: grey
  - `closed`: muted
- **Next-action memo (twist):** a line reading `→ {nextActionMemo}`, which you can edit in place.
  - Click it (or a ✎ icon) to turn it into an input.
  - **Enter** or blur saves with `api.setMemo(id, text)`. **Esc** cancels.
  - Show a "Saved" tick for a moment after saving.
  - When there's no memo, show the suggestion in grey italics, `→ Suggested: {action.nextStep}`, with a small **Use** button that copies it into the memo.
  - Put `action.reason` under it in smaller text when it isn't null.
  - Cap the input at 140 characters with `maxLength`.
- An inline **status `<select>`** that sends a PATCH as soon as it changes, then shows the toast "Nimbus Labs → Interview".
- Edit (opens the form) and Delete buttons.
- A job link icon, shown **only if** the link starts with `http://` or `https://`.
- Rejected cards are dimmed and sorted to the bottom (the API already sorts them).

### 5. Add/Edit form (a modal using the native `<dialog>` element)

| Field | Input | Rules |
|---|---|---|
| Company * | text | required, max 60 |
| Role * | text | required, max 60 |
| Next deadline * | `<input type="date">` | required; hint: "Apply-by, test due date, interview date or offer reply date" |
| Status | select | default Applied |
| Source | select | default Job board |
| Resume version | text + `<datalist>` of existing versions | default `v1-general`, max 30 |
| Company type | segmented buttons | Product / Service / Startup |
| Job link | url | optional; must be http(s) |
| Next action (memo) | text | optional, max 140; placeholder "e.g. Email HR for a new test link" |
| Notes | textarea + character counter | optional, max 500 |

- Put `maxLength` on every input. Also show the server's 400 errors inline.
- Disable Save while the request is in flight.
- On success: close the dialog and show the toast "Saved · Due in 2 days — added to Needs action". Scroll to the new card and flash it.
- Escape and Cancel both close the dialog. Focus the first field when it opens.

### 6. Delete with Undo
- DELETE, then a toast "Deleted Nimbus Labs · **Undo**" for 6 seconds. Undo calls `POST /:id/restore`.
- No confirm dialog; Undo replaces it.

### 7. Upcoming deadlines panel (required)
- Groups: **Overdue**, **Today**, **Tomorrow**, **This week**, **Later**, built from `deadlines`.
- Each row shows a date chip, company and role, and a severity dot. Clicking a row scrolls to its card.

### 8. Insights panel (build after minute 40)
- Funnel bars from `insights.funnel`, e.g. Applied 13 → Test 9 → Interview 5 → Offer 1, labelled with %.
- Show 2–3 `insights.messages` as callouts, with an icon for each tone and the `tip` in smaller text.
- Footnote: "Insights only appear once there are 3 or more applications in a group."

### 9. Global states
- Loading: skeleton cards.
- API error: a banner reading "Can't reach the server" with a Retry button.
- Empty: "No applications yet" with two buttons, **Load demo data** and **Add your first application**.
- Toasts appear bottom-centre on mobile and bottom-right on desktop.

---

## Layout

- **Desktop:** header, then the summary strip, then two columns:
  - Left (about 65%): filter bar and list.
  - Right: Upcoming deadlines, then Insights.
- **Mobile (< 768px):** one column. The summary tiles scroll horizontally, and "+ New" becomes a floating button. Judges may open the link on a phone.
- Status colours (keep them consistent everywhere):
  - Applied: blue
  - Test: violet
  - Interview: teal
  - Offer: green
  - Rejected: grey
- Badges always include text, never colour alone (accessibility).

## Security rules (the judges are OWASP)

- Never use `dangerouslySetInnerHTML`. Render all user text as plain text.
- Only render `<a href>` for `http:`/`https:` links, and add `rel="noopener noreferrer" target="_blank"`.
- Put `maxLength` on inputs. Never put user data in URLs.
- Use fictional company names only; no real personal data.
- Demo trick: type `<img src=x onerror=alert(1)>` as a company name. It must show as plain text.

## Frontend build order

| Minute | Goal |
|---|---|
| 0–10 | Layout shell, types, `api.ts` with mock Dashboard |
| 10–25 | Summary tiles, filter tabs, cards with badges, Upcoming deadlines |
| 25–35 | Form + validation, status select, delete/undo, then switch `api.ts` to the real API |
| 35–40 | Run the judge path three times with the backend |
| 40–60 | Minute 40 twist |
| 60–80 | Insights panel, empty/error states, mobile pass, toasts polish |
| 80–90 | Screenshots and screen recording. No new features. |
