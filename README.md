# NextUp: Internship Tracker (VibeSprint PS-18)

Students record internship applications (company, role, deadline, status), and NextUp tells them
**what needs action next and why**: "Online test due in 2 days", "Interview tomorrow",
"No reply in 16 days, send a follow-up".

## Run it

The only requirement is Node 22.18 or newer. No database, no `.env`, no API keys.

```bash
npm run build   # installs both halves and builds the frontend
npm start       # http://localhost:4100 serves the app and the API
npm test        # 32 backend tests: judge path and twist included
```

While developing, run two terminals: `cd backend && npm run dev` and `cd frontend && npm run dev`.
Vite proxies `/api` to port 4100.

### Deploy (Render free web service)
- Build command: `npm run build`
- Start command: `npm start`
- `PORT` is set by Render, so there's nothing else to configure.
- The free tier sleeps when idle, so open the link a minute before judging.

## Judge verification path

1. **Create** an application with a deadline within 3 days. It gets an amber **"Due in 2 days"** badge
   and moves to the top of the list.
2. **Needs action** filter: it's listed there with its reason.
3. **Change status**: the pipeline summary counts update straight away.

`backend/test/api.test.ts` runs these exact three steps against the real API.

## Minute-40 twist

| Twist requirement | How NextUp handles it |
|---|---|
| Three-day warning, applied automatically | Every response marks deadlines due today through 3 days out as `soon` (amber), with no user action needed |
| Filter showing only applications requiring action | **Needs action** = deadline within 72 hours, overdue, or no reply for 14+ days |
| Urgency highlighting within 72 hours | Amber card plus a badge ("Due in 2 days") and a reason ("Online test due in 2 days") |
| Status lifecycle | Exactly Applied → Test → Interview → Offer / Rejected. Any other value is rejected by the server |
| No scraping or OAuth email | None used. Everything is entered by the student |
| Editable next-action memo | `nextActionMemo` field (max 140 characters). Set it in the form or edit it on the card (`PATCH /api/applications/:id/memo`). With no memo, the card shows the suggested step. Calendar export uses the memo as the event title |

Deadlines are calendar dates, so "within 72 hours" means due today, tomorrow, or in 2 or 3 days.
The tests check the edges: day 3 is flagged, day 4 is not.

## How "needs action" works

All rules live in [`backend/src/rules.ts`](backend/src/rules.ts):

| Rule | Badge | Needs action |
|---|---|---|
| Deadline passed (not Rejected) | Overdue by N days (red) | yes, most urgent |
| Deadline in 0–3 days | Due today / tomorrow / in N days (amber) | yes |
| Applied, no update for 14+ days | No reply in N days | yes, follow up |
| Anything else that's open | Due 24 Nov | no |
| Rejected | Closed | no |

The list is sorted by urgency. Each status has its own next step (Test → "Finish the online test",
Offer → "Reply to the offer"), so the card always tells you what to do.

**Insights** ([`backend/src/insights.ts`](backend/src/insights.ts)) use each application's status history.
- **Funnel:** how many applications reached Test, then Interview, then Offer.
- **Rejections:** which stage they happen at, e.g. "3 of 5 came after the online test, all at Product companies".
- **Interview rates:** which source and which resume version get the most interviews.

A group needs at least 3 applications before the app draws any conclusion from it.

**Deadlines** can also be exported as an `.ics` file for Google Calendar, Apple Calendar or Outlook.

## Project layout

```
backend/   Express 5 + TypeScript (runs directly on Node, no build step)
  src/rules.ts       needs-action engine, sorting, summary, upcoming deadlines
  src/insights.ts    funnel and drop-off insights
  src/validation.ts  server-side validation and field allow-list
  src/store.ts       in-memory, one workspace per browser
  src/seed.ts        fictional demo data, dates relative to today
  src/security.ts    security headers, rate limit, workspace id
  src/ics.ts         calendar export
frontend/  Vite + React + TypeScript (see FRONTEND_SPEC.md)
  src/api.ts         typed API client
  src/types.ts       API contract
```

## Security notes

| Risk area | What we did |
|---|---|
| Broken access control | Each browser gets a random workspace id, so visitors never see each other's data |
| Injection / XSS | React renders user text as text. Links must be `http(s)`, which blocks `javascript:`. Strict Content-Security-Policy. Control characters are stripped |
| Insecure design | All validation happens on the server. Only known fields are accepted, so a client can't set `id`, `history` or `createdAt` |
| Resource abuse | 20 kB body limit, 200 applications per workspace, 500 workspaces, 600 requests/min per IP |
| Misconfiguration | Security headers (`nosniff`, frame denial, no referrer). `X-Powered-By` is off. No stack traces are sent to clients |
| Secrets & privacy | No secrets, no `.env`, no external calls, no tracking. All demo data is fictional (`.example` domains) |

## Known limits

- Data lives in server memory, so it resets when the server restarts or sleeps. This is fine for a
  prototype; a real version would add a database.
- The workspace id keeps visitors apart but isn't a login. Anyone who has the id can read that
  workspace.
