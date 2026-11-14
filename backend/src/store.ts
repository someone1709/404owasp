// In-memory store (Rule 01). Each browser gets its own workspace,
// keyed by a random id it keeps in localStorage, so judges testing the same
// deployment never see or overwrite each other's data. On serverless hosts a
// persistence adapter (see persistence.ts) saves and reloads each workspace around
// every request, so this same code works when no single server stays alive.

import { randomUUID } from 'node:crypto'
import { seedApplications } from './seed.ts'
import type { ApplicationDraft, ApplicationRecord, Status } from './types.ts'

export interface StoreOptions {
  maxWorkspaces?: number // oldest idle workspace is dropped past this
  maxItems?: number // per workspace, so nobody can fill the server's memory
}

export type Store = ReturnType<typeof createStore>

export function createStore({ maxWorkspaces = 500, maxItems = 200 }: StoreOptions = {}) {
  const workspaces = new Map<string, ApplicationRecord[]>()

  /** Put a workspace's list in the map as most recently used, evicting the oldest if full. */
  function place(ws: string, list: ApplicationRecord[]): ApplicationRecord[] {
    workspaces.delete(ws) // re-insert to mark as recently used
    if (workspaces.size >= maxWorkspaces) workspaces.delete(workspaces.keys().next().value!)
    workspaces.set(ws, list)
    return list
  }

  /** A workspace's records, seeded with demo data on first visit. */
  function records(ws: string, today: string): ApplicationRecord[] {
    return place(ws, workspaces.get(ws) ?? seedApplications(today))
  }

  function find(ws: string, today: string, id: string): ApplicationRecord | undefined {
    return records(ws, today).find((r) => r.id === id && !r.deletedAt)
  }

  function changeStatus(record: ApplicationRecord, status: Status, at: string) {
    if (record.status === status) return
    record.status = status
    record.history.push({ status, at })
  }

  return {
    list(ws: string, today: string): ApplicationRecord[] {
      return records(ws, today).filter((r) => !r.deletedAt)
    },

    /** Returns null when the workspace is full. */
    create(ws: string, today: string, draft: ApplicationDraft): ApplicationRecord | null {
      let list = records(ws, today)
      if (list.length >= maxItems) {
        list = list.filter((r) => !r.deletedAt) // make room by forgetting deleted items
        workspaces.set(ws, list)
        if (list.length >= maxItems) return null
      }
      const at = new Date().toISOString()
      const record: ApplicationRecord = {
        id: randomUUID(),
        ...draft,
        history: [{ status: draft.status, at }],
        createdAt: at,
      }
      list.push(record)
      return record
    },

    update(ws: string, today: string, id: string, draft: ApplicationDraft): ApplicationRecord | undefined {
      const record = find(ws, today, id)
      if (!record) return undefined
      const { status, ...fields } = draft
      Object.assign(record, fields) // link/notes are present as undefined when cleared
      changeStatus(record, status, new Date().toISOString())
      return record
    },

    setStatus(ws: string, today: string, id: string, status: Status): ApplicationRecord | undefined {
      const record = find(ws, today, id)
      if (record) changeStatus(record, status, new Date().toISOString())
      return record
    },

    setMemo(ws: string, today: string, id: string, memo: string | undefined): ApplicationRecord | undefined {
      const record = find(ws, today, id)
      if (record) record.nextActionMemo = memo
      return record
    },

    remove(ws: string, today: string, id: string): boolean {
      const record = find(ws, today, id)
      if (record) record.deletedAt = new Date().toISOString()
      return Boolean(record)
    },

    restore(ws: string, today: string, id: string): ApplicationRecord | undefined {
      const record = records(ws, today).find((r) => r.id === id && r.deletedAt)
      if (record) delete record.deletedAt
      return record
    },

    reset(ws: string, today: string) {
      place(ws, seedApplications(today)) // goes through place() so the workspace cap still applies
    },

    wipe(ws: string) {
      place(ws, [])
    },

    /** The workspace's records exactly as stored (for saving to a database), if it exists. */
    snapshot(ws: string): ApplicationRecord[] | undefined {
      return workspaces.get(ws)
    },

    /** Replace a workspace with records loaded from a database. */
    adopt(ws: string, list: ApplicationRecord[]) {
      place(ws, list.slice(0, maxItems))
    },
  }
}
