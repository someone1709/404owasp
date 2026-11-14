// MongoDB persistence (opt-in: only used when MONGODB_URI is set).
//
// One document per workspace in the `workspaces` collection:
//   { _id: <workspace id>, applications: [ ...application records ], updatedAt: <Date> }
// A workspace is capped at 200 records, so the document stays small. A TTL index on `updatedAt`
// removes workspaces that have not changed for two weeks, like the Redis adapter does.
//
// Environment variables:
//   MONGODB_URI   connection string, e.g. mongodb+srv://user:pass@cluster.mongodb.net  (a secret: never commit it)
//   MONGODB_DB    database name (default "nextup")

const COLLECTION = 'workspaces'
const TTL_SECONDS = 14 * 24 * 60 * 60
const MAX_ITEMS = 200

/** Adapter over any collection-like object (a real MongoDB collection, or a fake in tests). */
export function mongo(getCollection) {
  return {
    async load(workspace) {
      const doc = await (await getCollection()).findOne({ _id: workspace })
      // Only accept the shape we wrote, and never more than a workspace may hold.
      return Array.isArray(doc?.applications) ? doc.applications.slice(0, MAX_ITEMS) : null
    },
    async save(workspace, records) {
      // A JSON round trip drops `undefined` fields, so a cleared link is absent rather than stored as null.
      const applications = JSON.parse(JSON.stringify(records))
      await (await getCollection()).replaceOne({ _id: workspace }, { applications, updatedAt: new Date() }, { upsert: true })
    },
  }
}

// One connection per process, reused across requests (serverless functions stay warm between calls).
let cached
let liveClient

export function collectionFromUri(uri, dbName = 'nextup') {
  const key = `${uri}|${dbName}`
  if (cached?.key === key) return cached.promise

  const promise = (async () => {
    const { MongoClient } = await import('mongodb')
    const client = new MongoClient(uri, { appName: 'nextup', maxPoolSize: 5, serverSelectionTimeoutMS: 5000 })
    await client.connect()
    liveClient = client
    const collection = client.db(dbName).collection(COLLECTION)
    // Best effort: if the index already exists with other options, carry on without it.
    await collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: TTL_SECONDS }).catch(() => {})
    return collection
  })()

  cached = { key, promise }
  promise.catch(() => {
    if (cached?.promise === promise) cached = undefined // a failed connect is retried on the next request
  })
  return promise
}

/** MongoDB persistence from environment variables, or null when MONGODB_URI is not set. */
export function mongoFromEnv(env = process.env) {
  const uri = env.MONGODB_URI
  if (!uri) return null
  const dbName = env.MONGODB_DB || 'nextup'
  return mongo(() => collectionFromUri(uri, dbName))
}

/** Close the shared connection (used by tests and scripts so the process can exit). */
export async function closeMongo() {
  const pending = cached?.promise
  cached = undefined
  await pending?.catch(() => {})
  await liveClient?.close()
  liveClient = undefined
}
