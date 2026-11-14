# NextUp: Internship Tracker (VibeSprint PS-18)

Students record internship applications (company, role, deadline, status), and NextUp tells them
**what needs action next and why**: "Online test due in 2 days", "Interview tomorrow",
"No reply in 16 days, send a follow-up".

## Run it

The only requirement is Node 22.18 or newer. No database, no `.env`, no API keys.

```bash
npm run serve   # one command: build everything, then serve it all on http://localhost:4100
```

That is the same as running these two separately:

```bash
npm run build   # installs both halves and builds the frontend
npm start       # one Express server on :4100 serves the built UI and the /api routes
npm test        # 43 backend tests: judge path, twist, persistence and the Vercel bundle
```

While developing with hot reload, run two terminals: `cd backend && npm run dev` and
`cd frontend && npm run dev`. Vite proxies `/api` to port 4100.

The app has five pages with their own URLs: `/` (overview), `/applications`, `/deadlines`,
`/insights` and `/resume` (Resume Lab). The Express server answers every non-API path with the app,
so refreshing or sharing a link to any page works.

**Extras beyond the brief**

| Feature | Where |
|---|---|
| Full-screen menu (topographic lines, huge type, next-deadline widget) | **Menu** button or `M` |
| Command palette: jump to pages, run actions, open any application | `Ctrl/Cmd+K` or `/` |
| Keyboard shortcuts | `N` new application, `1`-`5` pages, `M` menu |
| Pipeline **board** (drag a card to change its status, or use the arrows) | Applications → Board |
| "Do this next" card for the single most urgent item | Overview |
| Live deadline ticker | Overview |
| 15-day deadline timeline | Deadlines |
| Role dropdown (12 common internship roles, or "Other") and resume file drop zone | New application form |
| **Resume Lab**: all resume versions, files, and interview rate per version | Resume Lab |
| Scroll choreography: elements rise in from depth, cards tilt in 3D by viewport position, hero parallax, marquee skews with scroll speed, charts draw in, split-letter headlines, scroll-progress rail and back-to-top ring | everywhere (all effects skipped with reduced motion) |
| **Pipeline in 3D**: a pinned scroll story where the five status layers rotate and pull apart, one stage at a time | bottom of Overview |
| Hover polish: rolling-letter links, sliding nav pill, magnetic buttons, cursor ring, card glow, confetti on an offer | everywhere (off on touch and with reduced motion) |

**Resume files stay in the browser.** They are stored in IndexedDB and never sent to the server, so
there is no upload endpoint to attack. Files are checked by extension, size (2 MB) and real file
signature (PDF, DOCX and DOC headers), are only ever downloaded (never rendered), and the file name
is shown as plain text.

The UI follows the Stitch "editorial job tracker" design (coral light theme, electric-blue dark
theme, with a toggle). Fonts are bundled from npm (`@fontsource-variable/*`), so the page loads
nothing from a CDN and works under the strict CSP.

### Deploy on Vercel

The repo is Vercel-ready: [`vercel.json`](vercel.json) builds the frontend (served from Vercel's CDN)
and routes `/api/*` to one serverless function, [`api/index.js`](api/index.js), which is the Express
backend pre-bundled into a single file.

1. In Vercel choose **Add New → Project** and import this repository. Leave the framework as
   **Other** and the root directory as it is; build and install commands come from `vercel.json`.
2. **Add a database so data survives** (strongly recommended): open the project's **Storage** tab, add
   **Upstash Redis** from the Marketplace and connect it to the project. That sets `KV_REST_API_URL`
   and `KV_REST_API_TOKEN` for you. Then redeploy.
3. Open the deployment URL. It works like the local app, with one URL for the page and the API.

Why step 2 matters: Vercel runs the backend as short-lived functions, and different requests can be
answered by different copies, so in-memory data would appear to come and go. With Redis configured
each workspace is loaded before a request and saved right before the response, so every copy agrees
(the last write wins if two copies write at the same instant). If Redis is unreachable the app keeps
working from memory instead of failing. Without Redis it still deploys, but expect data to reset.

Changing backend code? Run `npm run bundle` and commit the updated `api/index.js`
(`npm run build` does this too). A test fails if the committed file is out of date.

### Deploy (Render free web service)
- Build command: `npm run build`
- Start command: `npm start`
- `PORT` is set by Render, so there's nothing else to configure. Data stays in memory (one long-running
  process), so no database is needed there.
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
  src/persistence.ts optional Redis saving for serverless hosts (off unless configured)
  src/vercel.ts      serverless entry point (bundled into api/index.js by bundle.mjs)
api/index.js    generated Vercel function (the backend, bundled); vercel.json = Vercel config
frontend/  Vite + React + TypeScript (see FRONTEND_SPEC.md)
  src/App.tsx        app shell: navigation, shared state, data loading, toasts, actions
  src/router.tsx     tiny History-API router (real URLs, Back/Forward, no dependency)
  src/pages/         Overview (/), Applications, Deadlines, Insights, Resume Lab
  src/resumeStore.ts local resume vault (IndexedDB, never uploaded)
  src/fx.ts          pointer effects, scroll engine (reveals, depth, pinning), confetti
  src/fx.css         menu, palette, board, timeline, resume and hover styles
  src/ui/            hero + funnel, summary tiles, cards, form, side panels
  src/styles.css     design tokens (light + dark) and layout
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
| Untrusted files | Resumes never leave the browser (no upload endpoint). Type, size and file signature are validated, files are only downloaded, never opened or rendered |
| Secrets & privacy | No secrets, no `.env`, no external calls, no tracking. All demo data is fictional (`.example` domains) |

## Known limits

- Locally and on Render, data lives in server memory, so it resets when the server restarts or sleeps.
  On Vercel it is kept in Redis (see above); workspaces expire after 14 days without a change.
- The rate limiter counts requests per server copy, so on Vercel it is a soft limit.
- The workspace id keeps visitors apart but isn't a login. Anyone who has the id can read that
  workspace.
