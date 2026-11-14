# NextUp: low-level design

NextUp is a single-page React app plus a small Express API. The backend owns every rule (validation,
deadline maths, "needs action", insights); the frontend renders what the API returns and refetches the
dashboard after every change. The diagrams below render on GitHub.

## 1. System overview

```mermaid
flowchart LR
  subgraph Browser
    SPA["React SPA<br/>App shell, router, pages, UI"]
    API["api.ts<br/>fetch client"]
    LS[("localStorage<br/>workspace id, theme, view")]
    IDB[("IndexedDB<br/>resume files")]
  end
  subgraph Server["Express 5 API (Node)"]
    PIPE["Middleware pipeline"]
    ROUTES["Route handlers"]
    RULES["Rules engine<br/>rules.ts, insights.ts"]
    STORE[("In-memory store<br/>Map of workspaces")]
  end
  REDIS[("Upstash Redis<br/>optional")]

  SPA --> API
  SPA --- LS
  SPA --- IDB
  API -- "HTTP /api/*<br/>X-Workspace-Id + ?today=" --> PIPE
  PIPE --> ROUTES
  ROUTES --> RULES
  ROUTES --> STORE
  PIPE -. "load / save workspace<br/>(serverless only)" .-> REDIS
```

Resume files never reach the server: they are stored in IndexedDB only.

## 2. Frontend (Vite, React 19, TypeScript)

```mermaid
flowchart TD
  MAIN["main.tsx<br/>fonts, styles.css, fx.css"] --> APP

  subgraph APP["App.tsx: shell"]
    ROUTER["router.tsx<br/>History API, Link"]
    STATE["State: data, filter, query,<br/>view, theme, toast, form"]
    ACTIONS["Actions: create, status, memo,<br/>delete + undo, reset, export"]
    KEYS["Keyboard shortcuts<br/>N, /, M, 1-5, Ctrl+K"]
  end

  APP --> PAGES
  APP --> OVERLAYS

  subgraph PAGES["pages/"]
    HOME["Home (/)"]
    APPS["Applications<br/>list or board"]
    DL["Deadlines<br/>timeline + groups"]
    INS["Insights"]
    RES["Resume Lab"]
  end

  subgraph OVERLAYS["Overlays"]
    FORM["Form (dialog)<br/>role dropdown, resume drop zone"]
    PAL["Command palette"]
    MENU["Full-screen menu"]
    TOAST["Toasts + undo"]
  end

  PAGES --> UI["ui/: Card, Board, Timeline, PinScene,<br/>Ticker, NextUp, SummaryTiles ..."]

  ACTIONS --> APICLIENT["api.ts<br/>X-Workspace-Id, ?today=, ApiError"]
  RES --> RSTORE["resumeStore.ts<br/>IndexedDB vault"]
  FORM --> RSTORE
  APP --> FX["fx.ts: pointer effects,<br/>scroll engine, confetti"]
  APICLIENT --> BACKEND(("Express /api"))
```

**Data flow rule:** every successful `POST`, `PUT`, `PATCH` or `DELETE` is followed by `GET /api/dashboard`,
and the whole `Dashboard` object replaces state. Pages are pure views of that object plus local UI state
(filter, search, board/list view).

| Concern | Where |
|---|---|
| Routing | `router.tsx`: `useRouter`, `Link`, `RouterContext`. Real URLs, Back/Forward, deep links |
| API contract | `types.ts` (mirrors `backend/src/types.ts`), `api.ts` |
| Resume vault | `resumeStore.ts`: IndexedDB, type, size and file-signature checks, download only |
| Scroll and hover effects | `fx.ts` (+ `fx.css`): reveals, depth tilt, pinned 3D scene, magnetic buttons, cursor ring |
| Theme | `data-theme` on `<html>`; saved only after an explicit toggle |

## 3. Backend (Express 5, TypeScript, no build step locally)

```mermaid
flowchart TD
  REQ["Incoming request"] --> H["securityHeaders<br/>CSP, nosniff, frame deny, referrer"]
  H --> RL["rateLimit /api<br/>600 per minute per IP"]
  RL --> JSON["express.json<br/>20 kB limit"]
  JSON --> P{"persistence<br/>configured?"}
  P -- yes --> LOAD["load workspace from Redis<br/>store.adopt()"]
  P -- no --> CTX
  LOAD --> CTX["context()<br/>workspaceFrom(header), today from ?today="]
  CTX -- "invalid id" --> E400["400"]
  CTX --> ROUTE["Route handler"]
  ROUTE --> V["validation.ts<br/>allow-list, limits, http(s) links"]
  V -- "errors" --> E400V["400 { errors }"]
  V --> STORE["store.ts<br/>create, update, setStatus,<br/>setMemo, remove, restore, reset, wipe"]
  STORE --> R["rules.ts<br/>computeAction, buildDashboard"]
  R --> INS["insights.ts<br/>funnel + messages"]
  R --> OUT["JSON response"]
  INS --> OUT
  OUT --> SAVE{"changed, or<br/>first visit?"}
  SAVE -- "yes + persistence" --> RSAVE["save workspace to Redis<br/>(before the response ends)"]
  SAVE -- no --> DONE["response sent"]
  RSAVE --> DONE
```

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/dashboard` | items (sorted by urgency), summary, deadlines, insights |
| POST | `/api/applications` | create (201) or `400 { errors }` |
| PUT | `/api/applications/:id` | edit |
| PATCH | `/api/applications/:id/status` | change status (appends to history) |
| PATCH | `/api/applications/:id/memo` | set or clear the next-action memo |
| DELETE | `/api/applications/:id` | soft delete |
| POST | `/api/applications/:id/restore` | undo a delete |
| DELETE | `/api/applications` | wipe the workspace |
| POST | `/api/demo/reset` | reload demo data |
| GET | `/api/export.ics` | upcoming deadlines as a calendar file |

Every request carries `X-Workspace-Id` (random id kept in the browser) and `?today=YYYY-MM-DD`
(the browser's local date), so the server never guesses the day.

### The "needs action" rules (`rules.ts`)

| Condition (not Rejected) | Severity | Needs action |
|---|---|---|
| deadline in the past | `overdue` | yes |
| deadline in 0 to 3 days | `soon` | yes |
| Applied and quiet for 14+ days | `stale` | yes |
| anything else open | `ok` | no |
| Rejected | `closed` | no |

Sorting is by urgency, then deadline, then company. All of it is computed per request and never stored.

## 4. Sequence: create an application (the judge path)

```mermaid
sequenceDiagram
  actor U as User
  participant F as Form.tsx
  participant A as api.ts
  participant S as Express API
  participant D as Store + rules
  participant G as App.tsx

  U->>F: Fill in and press Save
  F->>A: create(draft)
  A->>S: POST /api/applications?today=...<br/>X-Workspace-Id
  S->>S: headers, rate limit, JSON, (load workspace)
  S->>D: validateDraft, store.create
  alt invalid
    D-->>S: errors
    S-->>A: 400 { errors }
    A-->>F: ApiError.errors (shown under fields)
  else valid
    D-->>S: record
    S-->>A: 201 Application { action: badge "Due in 2 days", severity "soon" }
    A-->>F: saved
    F-->>G: onSaved(saved)
    G->>A: dashboard()
    A->>S: GET /api/dashboard?today=...
    S->>D: buildDashboard
    D-->>S: items, summary, deadlines, insights
    S-->>G: Dashboard
    G-->>U: new amber card, counts, Needs action list updated, toast
  end
```

## 5. Data model

```mermaid
erDiagram
  WORKSPACE ||--o{ APPLICATION_RECORD : holds
  APPLICATION_RECORD ||--|{ STATUS_CHANGE : history
  APPLICATION_RECORD {
    string id PK "uuid"
    string company "max 60"
    string role "max 60"
    string deadline "YYYY-MM-DD"
    string status "Applied, Test, Interview, Offer, Rejected"
    string source "Referral, Campus, Job board, Company site, Cold email"
    string resumeVersion "label, max 30"
    string companyType "Product, Service, Startup"
    string link "optional, http(s) only"
    string notes "optional, max 500"
    string nextActionMemo "optional, max 140"
    string createdAt "timestamp"
    string deletedAt "optional, soft delete"
  }
  STATUS_CHANGE {
    string status
    string at "timestamp"
  }
```

| Store | Technology | Key and contents |
|---|---|---|
| Server memory (default) | JavaScript `Map` | workspace id to `ApplicationRecord[]`. 200 records per workspace, 500 workspaces |
| Redis (optional, serverless) | Upstash over REST | `nextup:ws:<workspace-id>` = JSON array, expires after 14 days |
| Browser | IndexedDB `nextup-resumes` / `files` | resume file per version label (never uploaded) |
| Browser | localStorage | `nextup:workspace`, `nextup:theme`, `nextup:view` |

## 6. Deployment

```mermaid
flowchart LR
  subgraph Local["Local / Render: one process"]
    EXP["Express :4100"]
    DIST[("frontend/dist")]
    MEM[("memory")]
    EXP -- "static + SPA fallback" --> DIST
    EXP --> MEM
  end

  subgraph Vercel["Vercel project: two services"]
    CDN["frontend service<br/>Vite build on the CDN"]
    FN["backend service<br/>Express function (src/vercel.ts)"]
    RED[("Upstash Redis<br/>KV_REST_API_URL / TOKEN")]
    CDN -- "/api/*" --> FN
    FN -.-> RED
  end
```

Run locally with `npm run serve`. On Vercel, requests to `/api/*` go to the backend service and everything
else to the frontend; without Redis the function falls back to memory, which can reset between requests.

## 7. Security controls

| Risk | Control |
|---|---|
| Injection / XSS | React renders text as text, no `dangerouslySetInnerHTML`; links limited to `http(s)`; strict CSP (no inline scripts, no CDNs) |
| Broken access control | per-browser workspace id; clients can only set allow-listed fields (never `id`, `history`, `createdAt`) |
| Input abuse | all validation on the server; 20 kB body limit; 200 records per workspace; 600 requests per minute per IP |
| Unsafe files | resumes stay in the browser; type, size and file signature checked; download only, never rendered |
| Misconfiguration | security headers on every response; no stack traces to clients; `X-Powered-By` off |
| Secrets | none in the repo; Redis credentials only as Vercel environment variables |
