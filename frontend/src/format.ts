// Small date and text helpers. Dates from the API are calendar dates ('YYYY-MM-DD'),
// so they are parsed as local dates, never through UTC.

import type { Status } from './types'

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Friday, 13 November" */
export const longDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** "15 Nov" */
export const shortDate = (iso: string) => parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** "Sat, 14 Nov" */
export const dayDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function daysBetween(fromISO: string, toISODate: string): number {
  return Math.round((parseDate(toISODate).getTime() - parseDate(fromISO).getTime()) / 86_400_000)
}

/** "added today" / "added 4d ago", from a full ISO timestamp. */
export function addedAgo(createdAt: string, today: string): string {
  const n = daysBetween(toISO(new Date(createdAt)), today)
  if (n <= 0) return 'added today'
  if (n === 1) return 'added yesterday'
  return `added ${n}d ago`
}

/** Short date from a full ISO timestamp: "9 Nov". */
export const stampDate = (at: string) => shortDate(toISO(new Date(at)))

export const pad2 = (n: number) => String(n).padStart(2, '0')

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Where each status sits in the pipeline (Rejected is off the track). */
export const STAGE: Record<Status, number> = { Applied: 1, Test: 2, Interview: 3, Offer: 4, Rejected: 0 }

export const NEXT_STAGE: Partial<Record<Status, Status>> = { Applied: 'Test', Test: 'Interview', Interview: 'Offer' }

export const STATUS_HINT: Record<Status, string> = {
  Applied: 'Awaiting a reply',
  Test: 'Online tests',
  Interview: 'Rounds in progress',
  Offer: 'Decide and reply',
  Rejected: 'Closed · lessons logged',
}

export const isHttpLink = (link?: string): link is string => !!link && /^https?:\/\//i.test(link)

/** 'YYYY-MM-DD' for a local Date. */
export const isoDate = toISO

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const weekdayShort = (iso: string) => parseDate(iso).toLocaleDateString('en-GB', { weekday: 'short' })
export const dayOfMonth = (iso: string) => parseDate(iso).getDate()
