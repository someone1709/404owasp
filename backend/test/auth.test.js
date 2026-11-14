import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createApp } from '../src/app.js'
import { createMemoryAuthStore, createMongoAuthStore } from '../src/auth-store.js'
import { sha256 } from '../src/auth.js'
import { addDays } from '../src/dates.js'
import { closeMongo, dbFromUri, mongo } from '../src/mongo.js'
import { hashPassword, verifyPassword } from '../src/passwords.js'

const TODAY = '2026-11-13'

/** One browser: remembers the session cookie between calls, like a real cookie jar. */
async function browser(options = {}) {
  const server = createApp({ frontendDir: '/nonexistent', ...options }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  return clientFor(server)
}

function clientFor(server) {
  const base = `http://localhost:${server.address().port}`
  const client = {
    cookie: '',
    server,
    close: () => server.close(),
    async call(method, path, body, headers = {}) {
      const res = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}today=${TODAY}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(client.cookie ? { Cookie: client.cookie } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const set = res.headers.get('set-cookie')
      if (set) client.cookie = set.startsWith('nextup_session=;') ? '' : set.split(';')[0]
      const text = await res.text()
      const isJson = res.headers.get('content-type')?.includes('json')
      return { status: res.status, headers: res.headers, setCookie: set, body: isJson && text ? JSON.parse(text) : text }
    },
  }
  return client
}

const account = (n = 1) => ({ email: `Student${n}@Example.com`, password: 'correct horse 42', name: `Student ${n}` })

describe('passwords', () => {
  test('hashes with a per-password salt and verifies only the right password', async () => {
    const a = await hashPassword('hunter2hunter2')
    const b = await hashPassword('hunter2hunter2')
    assert.match(a, /^scrypt\$16384\$8\$1\$/)
    assert.notEqual(a, b) // different salts
    assert.ok(!a.includes('hunter2'))
    assert.equal(await verifyPassword('hunter2hunter2', a), true)
    assert.equal(await verifyPassword('hunter2hunter3', a), false)
    assert.equal(await verifyPassword('x', 'not-a-hash'), false)
  })
})

describe('sign up, sign in, sign out', () => {
  test('register signs you in; the cookie is HttpOnly and SameSite=Lax; the password is never returned', async () => {
    const b = await browser()
    try {
      const res = await b.call('POST', '/api/auth/register', account())
      assert.equal(res.status, 201)
      assert.equal(res.body.user.email, 'student1@example.com') // normalised
      assert.equal(res.body.user.name, 'Student 1')
      assert.ok(!JSON.stringify(res.body).includes('correct horse'))
      assert.ok(!JSON.stringify(res.body).toLowerCase().includes('hash'))
      assert.match(res.setCookie, /nextup_session=/)
      assert.match(res.setCookie, /HttpOnly/i)
      assert.match(res.setCookie, /SameSite=Lax/i)
      assert.match(res.setCookie, /Max-Age=1209600/)
      assert.equal((await b.call('GET', '/api/auth/me')).body.user.email, 'student1@example.com')
    } finally {
      b.close()
    }
  })

  test('signed out: me is null; logout ends the session and the old cookie stops working', async () => {
    const b = await browser()
    try {
      assert.equal((await b.call('GET', '/api/auth/me')).body.user, null)
      await b.call('POST', '/api/auth/register', account())
      const oldCookie = b.cookie
      assert.equal((await b.call('POST', '/api/auth/logout')).status, 204)
      assert.equal((await b.call('GET', '/api/auth/me')).body.user, null)
      b.cookie = oldCookie // replay the stolen cookie
      assert.equal((await b.call('GET', '/api/auth/me')).body.user, null)
    } finally {
      b.close()
    }
  })

  test('login works with the right password; every failure is the same generic 401', async () => {
    const b = await browser()
    try {
      await b.call('POST', '/api/auth/register', account())
      await b.call('POST', '/api/auth/logout')
      const wrong = await b.call('POST', '/api/auth/login', { email: 'student1@example.com', password: 'wrong password!' })
      const unknown = await b.call('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'wrong password!' })
      assert.equal(wrong.status, 401)
      assert.equal(unknown.status, 401)
      assert.deepEqual(wrong.body, unknown.body) // no hint about which emails exist
      const ok = await b.call('POST', '/api/auth/login', { email: ' STUDENT1@example.com ', password: 'correct horse 42' })
      assert.equal(ok.status, 200)
      assert.equal((await b.call('GET', '/api/auth/me')).body.user.name, 'Student 1')
    } finally {
      b.close()
    }
  })

  test('validation: bad email, short password and missing fields get field errors', async () => {
    const b = await browser()
    try {
      const res = await b.call('POST', '/api/auth/register', { email: 'not-an-email', password: 'short' })
      assert.equal(res.status, 400)
      assert.ok(res.body.errors.email)
      assert.match(res.body.errors.password, /at least 8/)
      assert.equal((await b.call('POST', '/api/auth/register', {})).status, 400)
      assert.equal((await b.call('POST', '/api/auth/login', { email: 'a@b.co' })).body.errors.password, 'Password is required')
      assert.equal((await b.call('POST', '/api/auth/register', { ...account(), password: 'x'.repeat(129) })).status, 400)
    } finally {
      b.close()
    }
  })

  test('an email can only be registered once, whatever its capitalisation', async () => {
    const b = await browser()
    try {
      assert.equal((await b.call('POST', '/api/auth/register', account())).status, 201)
      const again = await b.call('POST', '/api/auth/register', { ...account(), email: 'STUDENT1@EXAMPLE.COM' })
      assert.equal(again.status, 409)
      assert.match(again.body.errors.email, /already registered/)
    } finally {
      b.close()
    }
  })

  test('only a hash is stored: the password is not in the store, and neither is the session token', async () => {
    const authStore = createMemoryAuthStore()
    const b = await browser({ authStore })
    try {
      await b.call('POST', '/api/auth/register', account())
      const user = await authStore.findUserByEmail('student1@example.com')
      assert.match(user.passwordHash, /^scrypt\$/)
      assert.ok(!JSON.stringify(user).includes('correct horse'))
      const token = b.cookie.split('=')[1]
      assert.ok(await authStore.findSession(sha256(token)), 'found by hash')
      assert.equal(await authStore.findSession(token), null, 'the raw token is not a key')
    } finally {
      b.close()
    }
  })
})

describe('your data belongs to your account', () => {
  test('a signed-in user gets a private workspace that follows the account, not the browser header', async () => {
    const b = await browser()
    try {
      await b.call('POST', '/api/auth/register', account())
      const first = await b.call('GET', '/api/dashboard', undefined, { 'X-Workspace-Id': 'anonymous-browser-1' })
      assert.equal(first.body.summary.total, 13)
      const created = await b.call(
        'POST',
        '/api/applications',
        { company: 'Acme', role: 'SDE Intern', deadline: addDays(TODAY, 2) },
        { 'X-Workspace-Id': 'anonymous-browser-1' },
      )
      assert.equal(created.status, 201)
      // a different browser header, same account: same data
      assert.equal(
        (await b.call('GET', '/api/dashboard', undefined, { 'X-Workspace-Id': 'a-different-browser' })).body.summary.total,
        14,
      )
      // signed out, the anonymous workspace never saw it
      await b.call('POST', '/api/auth/logout')
      assert.equal(
        (await b.call('GET', '/api/dashboard', undefined, { 'X-Workspace-Id': 'anonymous-browser-1' })).body.summary.total,
        13,
      )
      // signing back in brings it back
      await b.call('POST', '/api/auth/login', { email: 'student1@example.com', password: 'correct horse 42' })
      assert.equal((await b.call('GET', '/api/dashboard')).body.summary.total, 14)
    } finally {
      b.close()
    }
  })

  test("two accounts never see each other's applications", async () => {
    const authStore = createMemoryAuthStore()
    const a = await browser({ authStore })
    const b = await browser({ authStore })
    try {
      await a.call('POST', '/api/auth/register', account(1))
      await b.call('POST', '/api/auth/register', account(2))
      const mine = await a.call('POST', '/api/applications', {
        company: 'OnlyMine',
        role: 'SDE Intern',
        deadline: addDays(TODAY, 4),
      })
      const theirs = (await b.call('GET', '/api/dashboard')).body
      assert.ok(!theirs.items.some((i) => i.company === 'OnlyMine'))
      assert.equal((await b.call('PATCH', `/api/applications/${mine.body.id}/status`, { status: 'Offer' })).status, 404)
    } finally {
      a.close()
      b.close()
    }
  })

  test('/api/me/data shows what is stored about you, without the password hash', async () => {
    const b = await browser()
    try {
      assert.equal((await b.call('GET', '/api/me/data')).status, 401)
      await b.call('POST', '/api/auth/register', account())
      const res = await b.call('GET', '/api/me/data')
      assert.equal(res.status, 200)
      assert.equal(res.body.user.email, 'student1@example.com')
      assert.match(res.body.workspaceId, /^u_/)
      assert.equal(res.body.applications.length, 13)
      assert.ok(!JSON.stringify(res.body).includes('scrypt'))
    } finally {
      b.close()
    }
  })

  test('accounts and data survive across separate server copies that share a database', async () => {
    const authStore = createMemoryAuthStore() // stands in for the shared users + sessions collections
    const docs = new Map()
    const persistence = {
      load: async (ws) => docs.get(ws) ?? null,
      save: async (ws, records) => void docs.set(ws, JSON.parse(JSON.stringify(records))),
    }
    const a = await browser({ authStore, persistence })
    const b = await browser({ authStore, persistence })
    try {
      await a.call('POST', '/api/auth/register', account())
      await a.call('POST', '/api/applications', { company: 'Shared Co', role: 'SDE Intern', deadline: addDays(TODAY, 3) })
      b.cookie = a.cookie // the same signed-in browser, now answered by the other server copy
      assert.equal((await b.call('GET', '/api/auth/me')).body.user.email, 'student1@example.com')
      assert.ok((await b.call('GET', '/api/dashboard')).body.items.some((i) => i.company === 'Shared Co'))
    } finally {
      a.close()
      b.close()
    }
  })
})

describe('abuse protection', () => {
  test('sign-in attempts are rate limited', async () => {
    const b = await browser({ authAttemptsPerMinute: 4 })
    try {
      const codes = []
      for (let i = 0; i < 6; i++)
        codes.push((await b.call('POST', '/api/auth/login', { email: 'a@b.co', password: 'wrong wrong' })).status)
      assert.deepEqual(codes, [401, 401, 401, 401, 429, 429])
    } finally {
      b.close()
    }
  })

  test('a state-changing request from another website is refused', async () => {
    const b = await browser()
    try {
      const res = await b.call('POST', '/api/auth/register', account(), { Origin: 'https://evil.example' })
      assert.equal(res.status, 403)
      const same = await b.call('POST', '/api/auth/register', account(), {
        Origin: `http://localhost:${b.server.address().port}`,
      })
      assert.equal(same.status, 201)
    } finally {
      b.close()
    }
  })

  test('a malformed or unknown session cookie is simply treated as signed out', async () => {
    const b = await browser()
    try {
      for (const cookie of ['nextup_session=abc', `nextup_session=${'A'.repeat(43)}`, 'nextup_session=', 'garbage']) {
        b.cookie = cookie
        assert.equal((await b.call('GET', '/api/auth/me')).body.user, null)
      }
    } finally {
      b.close()
    }
  })

  test('expired sessions are rejected', async () => {
    const authStore = createMemoryAuthStore()
    await authStore.createSession({
      _id: 'old',
      userId: 'u',
      email: 'a@b.co',
      createdAt: new Date(0),
      expiresAt: new Date(Date.now() - 1000),
    })
    assert.equal(await authStore.findSession('old'), null)
  })

  test('if the account store is down, the app still works signed out', async () => {
    const broken = {
      ...createMemoryAuthStore(),
      findSession: async () => {
        throw new Error('db down')
      },
    }
    const b = await browser({ authStore: broken })
    const original = console.error
    console.error = () => {}
    try {
      b.cookie = `nextup_session=${'B'.repeat(43)}`
      assert.equal((await b.call('GET', '/api/auth/me')).body.user, null)
      assert.equal(
        (await b.call('GET', '/api/dashboard', undefined, { 'X-Workspace-Id': 'anonymous-browser-2' })).body.summary.total,
        13,
      )
    } finally {
      console.error = original
      b.close()
    }
  })
})

// Runs against a real MongoDB only when you point it at one, e.g.
//   MONGODB_TEST_URI=mongodb://localhost:27017 npm test
describe('accounts in a real MongoDB', { skip: !process.env.MONGODB_TEST_URI && 'set MONGODB_TEST_URI to run' }, () => {
  test('users and sessions are stored as documents, with a unique email and an expiring session index', async () => {
    const dbName = `nextup_auth_test_${Date.now()}`
    const db = await dbFromUri(process.env.MONGODB_TEST_URI, dbName)
    const authStore = createMongoAuthStore(() => db)
    const persistence = mongo(() => db.collection('workspaces'))
    const a = await browser({ authStore, persistence })
    const b = await browser({ authStore, persistence })
    try {
      assert.equal((await a.call('POST', '/api/auth/register', account())).status, 201)
      assert.equal((await b.call('POST', '/api/auth/register', account())).status, 409) // unique index

      const user = await db.collection('users').findOne({ email: 'student1@example.com' })
      assert.deepEqual(Object.keys(user).sort(), ['_id', 'createdAt', 'email', 'name', 'passwordHash'])
      assert.match(user.passwordHash, /^scrypt\$/)
      assert.ok(user.createdAt instanceof Date)

      const token = a.cookie.split('=')[1]
      const session = await db.collection('sessions').findOne({ _id: sha256(token) })
      assert.equal(session.userId, user._id)
      assert.ok(session.expiresAt instanceof Date)

      const indexes = await db.collection('users').indexes()
      assert.ok(
        indexes.some((i) => i.key.email === 1 && i.unique),
        'unique email index',
      )
      assert.ok(
        (await db.collection('sessions').indexes()).some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0),
        'session TTL index',
      )

      // sign in on the other server copy, with data written by the first
      await a.call('POST', '/api/applications', { company: 'Mongo Account Co', role: 'SDE Intern', deadline: addDays(TODAY, 3) })
      await b.call('POST', '/api/auth/login', { email: 'student1@example.com', password: 'correct horse 42' })
      assert.ok((await b.call('GET', '/api/dashboard')).body.items.some((i) => i.company === 'Mongo Account Co'))
      assert.ok(await db.collection('workspaces').findOne({ _id: `u_${user._id}` }), 'workspace document keyed by the account')
    } finally {
      a.close()
      b.close()
      await db.dropDatabase().catch(() => {})
      await closeMongo()
    }
  })
})
