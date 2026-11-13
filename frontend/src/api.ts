// Typed client for the NextUp backend. Every call sends:
//  - X-Workspace-Id: a random id kept in localStorage, so each browser has its own data
//  - ?today=YYYY-MM-DD: the browser's local date, so deadline maths matches the user's day

import type { Application, ApplicationDraft, Dashboard, FieldErrors, Status } from './types'

export class ApiError extends Error {
  status: number
  errors?: FieldErrors // per-field validation messages on a 400

  constructor(status: number, message: string, errors?: FieldErrors) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const WORKSPACE_KEY = 'nextup:workspace'
let memoryWorkspace = ''

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function workspaceId(): string {
  try {
    let id = localStorage.getItem(WORKSPACE_KEY)
    if (!id) {
      id = randomId()
      localStorage.setItem(WORKSPACE_KEY, id)
    }
    return id
  } catch {
    // Storage blocked (private mode etc.): keep one id for this tab.
    memoryWorkspace ||= randomId()
    return memoryWorkspace
  }
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`/api${path}?today=${localToday()}`, {
    method,
    headers: {
      'X-Workspace-Id': workspaceId(),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.error ?? 'Validation failed', data.errors)
  }
  return res
}

async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body)
  return (res.status === 204 ? undefined : await res.json()) as T
}

const item = (id: string) => `/applications/${encodeURIComponent(id)}`

export const api = {
  dashboard: () => json<Dashboard>('GET', '/dashboard'),
  create: (draft: ApplicationDraft) => json<Application>('POST', '/applications', draft),
  update: (id: string, draft: ApplicationDraft) => json<Application>('PUT', item(id), draft),
  setStatus: (id: string, status: Status) => json<Application>('PATCH', `${item(id)}/status`, { status }),
  /** Inline edit of the next-action memo. Pass '' to clear it. */
  setMemo: (id: string, nextActionMemo: string) => json<Application>('PATCH', `${item(id)}/memo`, { nextActionMemo }),
  remove: (id: string) => json<{ id: string }>('DELETE', item(id)),
  restore: (id: string) => json<Application>('POST', `${item(id)}/restore`),
  resetDemo: () => json<void>('POST', '/demo/reset'),
  wipeAll: () => json<void>('DELETE', '/applications'),

  /** Downloads upcoming deadlines as an .ics file for any calendar app. */
  async downloadCalendar() {
    const blob = await (await send('GET', '/export.ics')).blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'internship-deadlines.ics'
    a.click()
    URL.revokeObjectURL(url)
  },
}
