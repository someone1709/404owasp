// Optional persistence for hosts where no single server process stays alive (Vercel).
// Locally and on a long-running host (Render) nothing is configured and data stays in memory.
//
// Each workspace is stored as one JSON value in Redis, reached over its REST API with plain
// fetch (no SDK, no extra dependency). Works with Upstash Redis, which Vercel's Marketplace
// connects with these environment variables (either name pair is accepted):
//   KV_REST_API_URL + KV_REST_API_TOKEN       or
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const KEY_PREFIX = 'nextup:ws:'
const TTL_SECONDS = 14 * 24 * 60 * 60 // idle workspaces expire after two weeks
const MAX_ITEMS = 200

export function upstash(url, token, fetchFn = fetch) {
  async function command(args) {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) throw new Error(`Redis request failed (${res.status})`)
    return (await res.json()).result
  }

  return {
    async load(workspace) {
      const raw = await command(['GET', KEY_PREFIX + workspace])
      if (typeof raw !== 'string') return null
      const parsed = JSON.parse(raw)
      // Defensive: only accept the shape we wrote, and never more than a workspace may hold.
      return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : null
    },
    async save(workspace, records) {
      await command(['SET', KEY_PREFIX + workspace, JSON.stringify(records), 'EX', TTL_SECONDS])
    },
  }
}

/** Persistence from environment variables, or null (plain in-memory) when none are set. */
export function persistenceFromEnv(env = process.env) {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? upstash(url, token) : null
}
