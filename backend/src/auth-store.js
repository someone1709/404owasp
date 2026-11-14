// Where user accounts and login sessions are kept.
//
//   users     { _id, email (unique, lowercase), name, passwordHash, createdAt }
//   sessions  { _id: sha256(token), userId, email, name, createdAt, expiresAt }   (the token itself is never stored)
//
// In memory by default (lost on restart); in MongoDB when MONGODB_URI is set, where `sessions` expire
// automatically through a TTL index and `email` is protected by a unique index.

import { dbFromUri } from './mongo.js'

const MAX_MEMORY_USERS = 5000
const MAX_MEMORY_SESSIONS = 20000

export function createMemoryAuthStore() {
  const users = new Map() // _id -> user
  const emails = new Map() // email -> _id
  const sessions = new Map() // token hash -> session

  return {
    kind: 'memory',
    async createUser(user) {
      if (emails.has(user.email) || users.size >= MAX_MEMORY_USERS) return null
      users.set(user._id, user)
      emails.set(user.email, user._id)
      return user
    },
    async findUserByEmail(email) {
      return users.get(emails.get(email)) ?? null
    },
    async createSession(session) {
      if (sessions.size >= MAX_MEMORY_SESSIONS) sessions.delete(sessions.keys().next().value)
      sessions.set(session._id, session)
    },
    async findSession(hash) {
      const session = sessions.get(hash)
      if (session && session.expiresAt.getTime() <= Date.now()) {
        sessions.delete(hash)
        return null
      }
      return session ?? null
    },
    async deleteSession(hash) {
      sessions.delete(hash)
    },
  }
}

/** Auth store over a MongoDB database handle (or a fake with the same methods, in tests). */
export function createMongoAuthStore(getDb) {
  let ready
  async function collections() {
    const db = await getDb()
    ready ??= Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch(() => {}) // best effort; a missing index only loses the guarantee, not the feature
    await ready
    return { users: db.collection('users'), sessions: db.collection('sessions') }
  }

  return {
    kind: 'mongodb',
    async createUser(user) {
      const { users } = await collections()
      try {
        await users.insertOne(user)
        return user
      } catch (err) {
        if (err?.code === 11000) return null // that email is already registered
        throw err
      }
    },
    async findUserByEmail(email) {
      return (await collections()).users.findOne({ email })
    },
    async createSession(session) {
      await (await collections()).sessions.insertOne(session)
    },
    async findSession(hash) {
      const session = await (await collections()).sessions.findOne({ _id: hash })
      // The TTL cleaner runs about once a minute, so also check the expiry ourselves.
      return session && session.expiresAt.getTime() > Date.now() ? session : null
    },
    async deleteSession(hash) {
      await (await collections()).sessions.deleteOne({ _id: hash })
    },
  }
}

/** MongoDB accounts when MONGODB_URI is set, otherwise in-memory accounts. */
export function authStoreFromEnv(env = process.env) {
  if (!env.MONGODB_URI) return createMemoryAuthStore()
  const dbName = env.MONGODB_DB || 'nextup'
  return createMongoAuthStore(() => dbFromUri(env.MONGODB_URI, dbName))
}
