// In-memory store (Rule 01). Each browser gets its own workspace,
// keyed by a random id it keeps in localStorage, so judges testing the same
// deployment never see or overwrite each other's data. On serverless hosts a
// persistence adapter (see persistence.ts) saves and reloads each workspace around
// every request, so this same code works when no single server stays alive.

import { randomUUID } from 'node:crypto'
import { seedApplications } from './seed.js'

export function createStore({ maxWorkspaces = 500, maxItems = 200 } = {}) {
  const workspaces = new Map()

  /** Put a workspace's list in the map as most recently used, evicting the oldest if full. */
  function place(ws, list) {
    workspaces.delete(ws) // re-insert to mark as recently used
    if (workspaces.size >= maxWorkspaces) workspaces.delete(workspaces.keys().next().value)
    workspaces.set(ws, list)
    return list
  }

  /** A workspace's records, seeded with demo data on first visit. */
  function records(ws, today) {
    return place(ws, workspaces.get(ws) ?? seedApplications(today))
  }

  function find(ws, today, id) {
    return records(ws, today).find((r) => r.id === id && !r.deletedAt)
  }

  function changeStatus(record, status, at) {
    if (record.status === status) return
    record.status = status
    record.history.push({ status, at })
  }

  return {
    list(ws, today) {
      return records(ws, today).filter((r) => !r.deletedAt)
    },

    /** Returns null when the workspace is full. */
    create(ws, today, draft) {
      let list = records(ws, today)
      if (list.length >= maxItems) {
        list = list.filter((r) => !r.deletedAt) // make room by forgetting deleted items
        workspaces.set(ws, list)
        if (list.length >= maxItems) return null
      }
      const at = new Date().toISOString()
      const record = {
        id: randomUUID(),
        ...draft,
        history: [{ status: draft.status, at }],
        createdAt: at,
      }
      list.push(record)
      return record
    },

    update(ws, today, id, draft) {
      const record = find(ws, today, id)
      if (!record) return undefined
      const { status, ...fields } = draft
      Object.assign(record, fields) // link/notes are present as undefined when cleared
      changeStatus(record, status, new Date().toISOString())
      return record
    },

    setStatus(ws, today, id, status) {
      const record = find(ws, today, id)
      if (record) changeStatus(record, status, new Date().toISOString())
      return record
    },

    setMemo(ws, today, id, memo) {
      const record = find(ws, today, id)
      if (record) record.nextActionMemo = memo
      return record
    },

    remove(ws, today, id) {
      const record = find(ws, today, id)
      if (record) record.deletedAt = new Date().toISOString()
      return Boolean(record)
    },

    restore(ws, today, id) {
      const record = records(ws, today).find((r) => r.id === id && r.deletedAt)
      if (record) delete record.deletedAt
      return record
    },

    reset(ws, today) {
      place(ws, seedApplications(today)) // goes through place() so the workspace cap still applies
    },

    wipe(ws) {
      place(ws, [])
    },

    /** The workspace's records exactly as stored (for saving to a database), if it exists. */
    snapshot(ws) {
      return workspaces.get(ws)
    },

    /** Replace a workspace with records loaded from a database. */
    adopt(ws, list) {
      place(ws, list.slice(0, maxItems))
    },
  }
}
