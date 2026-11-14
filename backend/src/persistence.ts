// Optional persistence for hosts where no single server process stays alive (Vercel).
// Locally and on a long-running host (Render) nothing is configured and data stays in memory.
//
// Each workspace is stored as one JSON value in Redis, reached over its REST API with plain
// fetch (no SDK, no extra dependency). Works with Upstash Redis, which Vercel's Marketplace
// connects with these environment variables (either name pair is accepted):
//   KV_REST_API_URL + KV_REST_API_TOKEN       or
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

import type { ApplicationRecord } from './types.ts'

export interface Persistence {
  load(workspace: string): Promise<ApplicationRecord[] | null>
  save(workspace: string, records: ApplicationRecord[]): Promise<void>
}

const KEY_PREFIX = 'nextup:ws:'
const TTL_SECONDS = 14 * 24 * 60 * 60 // idle workspaces expire after two weeks
const MAX_ITEMS = 200

type Env = Record<string, string | undefined>

export function upstash(url: string, token: string, fetchFn: typeof fetch = fetch): Persistence {
  async function command(args: (string | number)[]): Promise<unknown> {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) throw new Error(`Redis request failed (${res.status})`)
    return ((await res.json()) as { result?: unknown }).result
  }

  return {
    async load(workspace) {
      const raw = await command(['GET', KEY_PREFIX + workspace])
      if (typeof raw !== 'string') return null
      const parsed: unknown = JSON.parse(raw)
      // Defensive: only accept the shape we wrote, and never more than a workspace may hold.
      return Array.isArray(parsed) ? (parsed.slice(0, MAX_ITEMS) as ApplicationRecord[]) : null
    },
    async save(workspace, records) {
      await command(['SET', KEY_PREFIX + workspace, JSON.stringify(records), 'EX', TTL_SECONDS])
    },
  }
}

/** Persistence from environment variables, or null (plain in-memory) when none are set. */
export function persistenceFromEnv(env: Env = process.env): Persistence | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? upstash(url, token) : null
}
