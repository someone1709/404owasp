import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createApp } from '../src/app.js'
import { addDays } from '../src/dates.js'
import { closeMongo, collectionFromUri, mongo, mongoFromEnv } from '../src/mongo.js'
import { persistenceFromEnv } from '../src/persistence.js'

const TODAY = '2026-11-13'

/** The few collection methods the adapter uses, backed by a Map. Stores what it is given, like a driver would. */
function fakeCollection() {
  const docs = new Map()
  return {
    docs,
    async findOne({ _id }) {
      return docs.get(_id) ?? null
    },
    async replaceOne({ _id }, replacement, { upsert }) {
      if (!docs.has(_id) && !upsert) return { matchedCount: 0 }
      docs.set(_id, { _id, ...replacement })
      return { matchedCount: 1 }
    },
  }
}

async function instance(persistence) {
  const server = createApp({ frontendDir: '/nonexistent', persistence }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://localhost:${server.address().port}/api`
  return {
    close: () => server.close(),
    async call(ws, method, path, body) {
      const res = await fetch(`${base}${path}?today=${TODAY}`, {
        method,
        headers: { 'X-Workspace-Id': ws, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await res.text()
      return { status: res.status, body: res.headers.get('content-type')?.includes('json') && text ? JSON.parse(text) : text }
    },
  }
}

describe('MongoDB adapter (fake collection)', () => {
  test("two instances sharing one collection see each other's changes", async () => {
    const collection = fakeCollection()
    const a = await instance(mongo(() => collection))
    const b = await instance(mongo(() => collection))
    try {
      const ws = 'mongo-workspace-1'
      const created = await a.call(ws, 'POST', '/applications', {
        company: 'Helix Robotics',
        role: 'SDE Intern',
        deadline: addDays(TODAY, 2),
      })
      assert.equal(created.status, 201)
      const seen = (await b.call(ws, 'GET', '/dashboard')).body
      assert.equal(seen.summary.total, 14)
      assert.equal((await b.call(ws, 'PATCH', `/applications/${created.body.id}/status`, { status: 'Interview' })).status, 200)
      assert.equal((await a.call(ws, 'GET', '/dashboard')).body.items.find((i) => i.id === created.body.id).status, 'Interview')
    } finally {
      a.close()
      b.close()
    }
  })

  test('stores one document per workspace: { _id, applications, updatedAt }', async () => {
    const collection = fakeCollection()
    const a = await instance(mongo(() => collection))
    try {
      await a.call('mongo-workspace-2', 'GET', '/dashboard') // first visit saves the demo data
      const doc = collection.docs.get('mongo-workspace-2')
      assert.equal(doc._id, 'mongo-workspace-2')
      assert.equal(doc.applications.length, 13)
      assert.ok(doc.updatedAt instanceof Date)
      assert.deepEqual(Object.keys(doc).sort(), ['_id', 'applications', 'updatedAt'])
    } finally {
      a.close()
    }
  })

  test('cleared optional fields are removed, not stored as null', async () => {
    const collection = fakeCollection()
    const a = await instance(mongo(() => collection))
    try {
      const ws = 'mongo-workspace-3'
      const c = await a.call(ws, 'POST', '/applications', {
        company: 'Acme',
        role: 'SDE Intern',
        deadline: addDays(TODAY, 5),
        link: 'https://acme.example',
      })
      await a.call(ws, 'PUT', `/applications/${c.body.id}`, {
        company: 'Acme',
        role: 'SDE Intern',
        deadline: addDays(TODAY, 5),
        link: '',
      })
      const stored = collection.docs.get(ws).applications.find((r) => r.id === c.body.id)
      assert.equal('link' in stored, false)
    } finally {
      a.close()
    }
  })

  test('ignores a malformed document, and caps what it loads', async () => {
    const collection = fakeCollection()
    const db = mongo(() => collection)
    collection.docs.set('bad-workspace-1', { _id: 'bad-workspace-1', applications: 'not a list' })
    assert.equal(await db.load('bad-workspace-1'), null)
    assert.equal(await db.load('missing-workspace'), null)
    collection.docs.set('big-workspace-1', {
      _id: 'big-workspace-1',
      applications: Array.from({ length: 500 }, (_, i) => ({ id: String(i) })),
    })
    assert.equal((await db.load('big-workspace-1')).length, 200)
  })

  test('a database error is survived: the app keeps working from memory', async () => {
    const broken = {
      findOne: async () => {
        throw new Error('db down')
      },
      replaceOne: async () => {
        throw new Error('db down')
      },
    }
    const a = await instance(mongo(() => broken))
    const original = console.error
    console.error = () => {}
    try {
      assert.equal((await a.call('mongo-workspace-4', 'GET', '/dashboard')).body.summary.total, 13)
    } finally {
      console.error = original
      a.close()
    }
  })
})

describe('choosing a database from the environment', () => {
  test('MONGODB_URI enables MongoDB (without connecting yet) and beats Redis', () => {
    assert.equal(mongoFromEnv({}), null)
    assert.ok(mongoFromEnv({ MONGODB_URI: 'mongodb://localhost:27017' }))
    const both = persistenceFromEnv({
      MONGODB_URI: 'mongodb://localhost:27017',
      KV_REST_API_URL: 'https://x',
      KV_REST_API_TOKEN: 't',
    })
    assert.ok(both)
    assert.equal(typeof both.load, 'function')
  })

  test('without MONGODB_URI it falls back to Redis, then to memory', () => {
    assert.ok(persistenceFromEnv({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' }))
    assert.equal(persistenceFromEnv({}), null)
  })
})

// Runs against a real MongoDB only when you point it at one, e.g.
//   MONGODB_TEST_URI=mongodb://localhost:27017 npm test
describe('MongoDB adapter (real database)', { skip: !process.env.MONGODB_TEST_URI && 'set MONGODB_TEST_URI to run' }, () => {
  test('persists across two app instances, with the documented shape and a TTL index', async () => {
    const dbName = `nextup_test_${Date.now()}`
    const collection = await collectionFromUri(process.env.MONGODB_TEST_URI, dbName)
    const a = await instance(mongo(() => collection))
    const b = await instance(mongo(() => collection))
    try {
      const ws = 'real-mongo-workspace-1'
      const created = await a.call(ws, 'POST', '/applications', {
        company: 'Real Mongo Co',
        role: 'Backend Intern',
        deadline: addDays(TODAY, 2),
      })
      assert.equal(created.status, 201)
      const seen = (await b.call(ws, 'GET', '/dashboard')).body
      assert.ok(seen.items.some((i) => i.id === created.body.id))

      const doc = await collection.findOne({ _id: ws })
      assert.deepEqual(Object.keys(doc).sort(), ['_id', 'applications', 'updatedAt'])
      assert.ok(doc.updatedAt instanceof Date)
      assert.equal(doc.applications.length, 14)

      const indexes = await collection.indexes()
      assert.ok(
        indexes.some((i) => i.key.updatedAt === 1 && i.expireAfterSeconds === 14 * 24 * 60 * 60),
        'TTL index on updatedAt',
      )
    } finally {
      a.close()
      b.close()
      await collection.drop().catch(() => {})
      await closeMongo()
    }
  })
})
