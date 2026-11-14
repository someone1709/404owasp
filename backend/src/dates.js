// Calendar-day maths on 'YYYY-MM-DD' strings, done in UTC so the server's own
// timezone never matters. The browser sends its local "today" with each request.

const DAY_MS = 24 * 60 * 60 * 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  return new Date(toUTC(value)).toISOString().slice(0, 10) === value
}

export function addDays(iso, n) {
  return new Date(toUTC(iso) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function diffDays(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS)
}

/** Whole days between the calendar day of a timestamp and `today`. */
export function daysSince(timestamp, today) {
  return diffDays(timestamp.slice(0, 10), today)
}

/** Fallback when the client sends no date. */
export function serverToday() {
  return new Date().toISOString().slice(0, 10)
}

/** A timestamp on the given day (10:30 IST), used for demo history. */
export function timestampOn(iso) {
  return new Date(toUTC(iso) + 5 * 60 * 60 * 1000).toISOString()
}

const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** '2026-11-24' -> '24 Nov' */
export function formatShort(iso) {
  return shortFmt.format(new Date(toUTC(iso)))
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
