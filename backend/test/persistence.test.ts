import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { describe, test } from 'node:test'
import { createApp } from '../src/app.ts'
import { addDays } from '../src/dates.ts'
import { persistenceFromEnv, upstash } from '../src/persistence.ts'
import type { Persistence } from '../src/persistence.ts'
import { createStore } from '../src/store.ts'
import type { ApplicationRecord, Dashboard } from '../src/types.ts'

const TODAY = '2026-11-13'

/** A stand-in database: a Map shared by every "instance" that is given it. */
function fakeDb(): Persistence & { data: Map<string, string>; saves: number } {
  const data = new Map<string, string>()
  const db = {
    data,
    saves: 0,
    async load(ws: string) {
      const raw = data.get(ws)
      return raw ? (JSON.parse(raw) as ApplicationRecord[]) : null
    },
    async save(ws: string, records: ApplicationRecord[]) {
      db.saves++
      data.set(ws, JSON.stringify(records))
    },
  }
  return db
}

/** Starts one app instance (its own empty memory) and returns a helper to call it. */
async function instance(persistence: Persistence | null) {
  const server = createApp({ frontendDir: '/nonexistent', persistence }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api`
  return {
    close: () => server.close(),
    async call(ws: string, method: string, path: string, body?: unknown) {
      const res = await fetch(`${base}${path}?today=${TODAY}`, {
        method,
        headers: { 'X-Workspace-Id': ws, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await res.text()
      const isJson = res.headers.get('content-type')?.includes('json')
      return { status: res.status, body: isJson && text ? JSON.parse(text) : text }
    },
  }
}

describe('persistence across serverless instances', () => {
  test('a change made on one instance is visible on another with empty memory', async () => {
    const db = fakeDb()
    const a = await instance(db)
    const b = await instance(db)
    try {
      const ws = 'persist-workspace-1'
      const created = await a.call(ws, 'POST', '/applications', { company: 'Helix Robotics', role: 'SDE Intern', deadline: addDays(TODAY, 2) })
      assert.equal(created.status, 201)

      const seen = (await b.call(ws, 'GET', '/dashboard')).body as Dashboard
      assert.equal(seen.summary.total, 14)
      assert.ok(seen.items.some((i) => i.id === created.body.id))

      // ...and an edit made on the second instance reaches the first.
      const moved = await b.call(ws, 'PATCH', `/applications/${created.body.id}/status`, { status: 'Interview' })
      assert.equal(moved.status, 200)
      const back = (await a.call(ws, 'GET', '/dashboard')).body as Dashboard
      assert.equal(back.items.find((i) => i.id === created.body.id)?.status, 'Interview')
    } finally {
      a.close()
      b.close()
    }
  })

  test('demo data keeps the same ids on every instance (first visit is saved)', async () => {
    const db = fakeDb()
    const a = await instance(db)
    const b = await instance(db)
    try {
      const ws = 'persist-workspace-2'
      const first = (await a.call(ws, 'GET', '/dashboard')).body as Dashboard
      const second = (await b.call(ws, 'GET', '/dashboard')).body as Dashboard
      assert.deepEqual(second.items.map((i) => i.id), first.items.map((i) => i.id))
      // So acting on an id from one instance works on the other.
      const target = first.items[0].id
      assert.equal((await b.call(ws, 'PATCH', `/applications/${target}/memo`, { nextActionMemo: 'Call HR' })).status, 200)
    } finally {
      a.close()
      b.close()
    }
  })

  test('wipe and undo-delete are persisted too', async () => {
    const db = fakeDb()
    const a = await instance(db)
    const b = await instance(db)
    try {
      const ws = 'persist-workspace-3'
      const d = (await a.call(ws, 'GET', '/dashboard')).body as Dashboard
      const id = d.items[0].id
      await a.call(ws, 'DELETE', `/applications/${id}`)
      assert.equal(((await b.call(ws, 'GET', '/dashboard')).body as Dashboard).summary.total, 12)
      await b.call(ws, 'POST', `/applications/${id}/restore`)
      assert.equal(((await a.call(ws, 'GET', '/dashboard')).body as Dashboard).summary.total, 13)
      await a.call(ws, 'DELETE', '/applications')
      assert.equal(((await b.call(ws, 'GET', '/dashboard')).body as Dashboard).summary.total, 0)
    } finally {
      a.close()
      b.close()
    }
  })

  test('reads of an existing workspace do not write; health and bad ids never touch the database', async () => {
    const db = fakeDb()
    const a = await instance(db)
    try {
      const ws = 'persist-workspace-4'
      await a.call(ws, 'GET', '/dashboard') // first visit: saved once
      const afterFirst = db.saves
      await a.call(ws, 'GET', '/dashboard')
      await a.call(ws, 'GET', '/export.ics')
      assert.equal(db.saves, afterFirst)
      await a.call('x', 'GET', '/dashboard') // too short to be a valid id
      assert.equal(db.saves, afterFirst)
      assert.equal((await a.call(ws, 'GET', '/health')).status, 200)
    } finally {
      a.close()
    }
  })

  test('if the database is down the app keeps working from memory', async () => {
    const broken: Persistence = {
      async load() {
        throw new Error('database down')
      },
      async save() {
        throw new Error('database down')
      },
    }
    const a = await instance(broken)
    const errors = console.error
    console.error = () => {} // the app logs the failure; keep test output clean
    try {
      const ws = 'persist-workspace-5'
      assert.equal(((await a.call(ws, 'GET', '/dashboard')).body as Dashboard).summary.total, 13)
      const created = await a.call(ws, 'POST', '/applications', { company: 'Acme', role: 'SDE Intern', deadline: addDays(TODAY, 5) })
      assert.equal(created.status, 201)
    } finally {
      console.error = errors
      a.close()
    }
  })
})

describe('Upstash Redis adapter', () => {
  test('sends SET with an expiry and reads it back with GET', async () => {
    const sent: { url: string; auth: string | null; body: unknown[] }[] = []
    let stored: string | null = null
    const fakeFetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as unknown[]
      sent.push({ url, auth: new Headers(init.headers).get('authorization'), body })
      if (body[0] === 'SET') stored = body[2] as string
      return new Response(JSON.stringify({ result: body[0] === 'GET' ? stored : 'OK' }), { status: 200 })
    }) as unknown as typeof fetch

    const db = upstash('https://redis.example', 'secret-token', fakeFetch)
    assert.equal(await db.load('ws-one-1234'), null)
    await db.save('ws-one-1234', [{ id: '1', company: 'A' } as ApplicationRecord])
    const loaded = await db.load('ws-one-1234')
    assert.equal(loaded?.[0].company, 'A')

    const set = sent.find((s) => s.body[0] === 'SET')!
    assert.equal(set.url, 'https://redis.example')
    assert.equal(set.auth, 'Bearer secret-token')
    assert.equal(set.body[1], 'nextup:ws:ws-one-1234')
    assert.equal(set.body[3], 'EX')
    assert.ok(Number(set.body[4]) > 0)
  })

  test('a failed Redis call throws, and junk data is ignored', async () => {
    const failing = upstash('https://redis.example', 't', (async () => new Response('no', { status: 500 })) as unknown as typeof fetch)
    await assert.rejects(() => failing.load('ws-two-1234'))
    const junk = upstash('https://redis.example', 't', (async () => new Response(JSON.stringify({ result: '{"not":"a list"}' }))) as unknown as typeof fetch)
    assert.equal(await junk.load('ws-two-1234'), null)
  })

  test('is only enabled when both variables are present (either name pair)', () => {
    assert.equal(persistenceFromEnv({}), null)
    assert.equal(persistenceFromEnv({ KV_REST_API_URL: 'https://x' }), null)
    assert.ok(persistenceFromEnv({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' }))
    assert.ok(persistenceFromEnv({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }))
  })
})

describe('store limits', () => {
  test('reset and wipe on new workspaces still respect the workspace cap', () => {
    const store = createStore({ maxWorkspaces: 3 })
    for (const ws of ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']) store.list(ws, TODAY)
    store.reset('dddddddd', TODAY) // used to bypass the cap
    store.wipe('eeeeeeee') // ...and so did this
    const alive = ['aaaaaaaa', 'bbbbbbbb', 'cccccccc', 'dddddddd', 'eeeeeeee'].filter((ws) => store.snapshot(ws))
    assert.equal(alive.length, 3)
    assert.deepEqual(alive, ['cccccccc', 'dddddddd', 'eeeeeeee']) // oldest were dropped
  })

  test('adopt keeps a workspace within the per-workspace item limit', () => {
    const store = createStore({ maxItems: 5 })
    const many = Array.from({ length: 50 }, (_, i) => ({ id: String(i) }) as ApplicationRecord)
    store.adopt('ffffffff', many)
    assert.equal(store.snapshot('ffffffff')?.length, 5)
  })
})
