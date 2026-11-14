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
npm test        # 42 backend tests: judge path, twist and persistence
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

The repo uses Vercel's **services** layout ([`vercel.json`](vercel.json)): the Vite frontend
(`frontend/`) and the Express backend (`backend/`, entry `src/vercel.js`) deploy together as one
project, with `/api/*` routed to the backend and everything else to the frontend.

With the Vercel CLI, from the project folder:

```bash
vercel deploy --yes     # a preview deployment
vercel deploy --prod    # production
```

Or import the repository in the Vercel dashboard (**Add New → Project**); services are detected on
their own and the settings come from `vercel.json`.

**Add a database so data survives** (strongly recommended). The app uses **MongoDB** when
`MONGODB_URI` is set (see [Database](#database)). The quickest way on Vercel:

1. Create a free **MongoDB Atlas** cluster (M0) and a database user. Under **Network Access** allow
   `0.0.0.0/0`, because Vercel functions do not have fixed IP addresses. (Or add the **MongoDB Atlas**
   integration from the Vercel Marketplace, which does this and sets the variable for you.)
2. In Atlas choose **Connect → Drivers** and copy the connection string.
3. Add it to the Vercel project as `MONGODB_URI` (Project → Settings → Environment Variables, or
   `vercel env add MONGODB_URI production` and paste it at the prompt). It is a secret: never commit it.
4. Redeploy (`vercel deploy --prod`).

Why it matters: Vercel runs the backend as short-lived functions, and different requests can be
answered by different copies, so in-memory data can appear to come and go. With a database configured,
each workspace is loaded before a request and saved right before the response, so every copy agrees
(the last write wins if two copies write at the same instant). If the database is unreachable the app
keeps working from memory instead of failing. Without one it still deploys, but expect data to reset.
Upstash Redis (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) also works, if MongoDB is not set.

New projects have **Deployment Protection** on, which asks visitors to sign in to Vercel. Turn it off
(Project → Settings → Deployment Protection) for a link anyone can open.

### Deploy (Render free web service)
- Build command: `npm run build`
- Start command: `npm start`
- `PORT` is set by Render, so there's nothing else to configure. Data stays in memory (one long-running
  process), so no database is needed there.
- The free tier sleeps when idle, so open the link a minute before judging.

## Database

By default there is none: data lives in server memory and resets on a restart. Set `MONGODB_URI` to
keep it in **MongoDB** instead (the official `mongodb` driver; Atlas or any MongoDB 5+).

| | |
|---|---|
| Database / collection | `nextup` (override with `MONGODB_DB`) / `workspaces` |
| Document | one per browser workspace: `{ _id: <workspace id>, applications: [ ...records ], updatedAt: <Date> }` |
| Record fields | see `backend/src/types.js` (`ApplicationRecord`); at most 200 per workspace |
| Expiry | a TTL index on `updatedAt` removes workspaces unchanged for 14 days |
| Selected by | `MONGODB_URI` first, then Upstash Redis (`KV_REST_API_*`), then memory |

Run it locally against MongoDB:

```bash
docker run -d --name nextup-mongo -p 27017:27017 mongo:7
MONGODB_URI=mongodb://localhost:27017 npm start        # http://localhost:4100, data now survives restarts
```

To look at the data: **Atlas → Browse Collections → nextup → workspaces**, or MongoDB Compass, or
`mongosh "$MONGODB_URI" --eval 'db.getSiblingDB("nextup").workspaces.find()'`.
Find your own workspace id in the browser console with `localStorage.getItem('nextup:workspace')`.

Tests run against a fake collection by default. To run the real-database test as well:
`MONGODB_TEST_URI=mongodb://localhost:27017 npm test`.

## Judge verification path

1. **Create** an application with a deadline within 3 days. It gets an amber **"Due in 2 days"** badge
   and moves to the top of the list.
2. **Needs action** filter: it's listed there with its reason.
3. **Change status**: the pipeline summary counts update straight away.

`backend/test/api.test.js` runs these exact three steps against the real API.

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

All rules live in [`backend/src/rules.js`](backend/src/rules.js):

| Rule | Badge | Needs action |
|---|---|---|
| Deadline passed (not Rejected) | Overdue by N days (red) | yes, most urgent |
| Deadline in 0–3 days | Due today / tomorrow / in N days (amber) | yes |
| Applied, no update for 14+ days | No reply in N days | yes, follow up |
| Anything else that's open | Due 24 Nov | no |
| Rejected | Closed | no |

The list is sorted by urgency. Each status has its own next step (Test → "Finish the online test",
Offer → "Reply to the offer"), so the card always tells you what to do.

**Insights** ([`backend/src/insights.js`](backend/src/insights.js)) use each application's status history.
- **Funnel:** how many applications reached Test, then Interview, then Offer.
- **Rejections:** which stage they happen at, e.g. "3 of 5 came after the online test, all at Product companies".
- **Interview rates:** which source and which resume version get the most interviews.

A group needs at least 3 applications before the app draws any conclusion from it.

**Deadlines** can also be exported as an `.ics` file for Google Calendar, Apple Calendar or Outlook.

## Project layout

```
backend/   Express 5, JavaScript ES modules (runs directly on Node, no build step)
  src/rules.js       needs-action engine, sorting, summary, upcoming deadlines
  src/insights.js    funnel and drop-off insights
  src/validation.js  server-side validation and field allow-list
  src/store.js       in-memory, one workspace per browser
  src/seed.js        fictional demo data, dates relative to today
  src/security.js    security headers, rate limit, workspace id
  src/ics.js         calendar export
  src/mongo.js       optional MongoDB storage (on when MONGODB_URI is set)
  src/persistence.js picks a database from the environment: MongoDB, else Upstash Redis, else memory
  src/vercel.js      serverless entry point for Vercel
vercel.json       Vercel config (frontend + backend services)
frontend/  Vite + React, JavaScript (JSX) (see FRONTEND_SPEC.md)
  src/App.jsx        app shell: navigation, shared state, data loading, toasts, actions
  src/router.jsx     tiny History-API router (real URLs, Back/Forward, no dependency)
  src/pages/         Overview (/), Applications, Deadlines, Insights, Resume Lab
  src/resumeStore.js local resume vault (IndexedDB, never uploaded)
  src/fx.js          pointer effects, scroll engine (reveals, depth, pinning), confetti
  src/fx.css         menu, palette, board, timeline, resume and hover styles
  src/ui/            hero + funnel, summary tiles, cards, form, side panels
  src/styles.css     design tokens (light + dark) and layout
  src/api.js         API client
  src/types.js       API contract (constants + JSDoc typedefs)
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
  With a database configured (MongoDB, or Redis) it is kept there; workspaces expire after 14 days without a change.
- The rate limiter counts requests per server copy, so on Vercel it is a soft limit.
- The workspace id keeps visitors apart but isn't a login. Anyone who has the id can read that
  workspace.
