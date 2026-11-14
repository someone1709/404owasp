// Calendar export (RFC 5545) for upcoming deadlines. Works with Google
// Calendar, Apple Calendar and Outlook, with no API involved.

import { addDays } from './dates.js'

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 characters continue on the next line, indented by one space. */
function fold(line) {
  const chars = [...line]
  if (chars.length <= 74) return line
  const parts = []
  for (let i = 0; i < chars.length; i += 74) parts.push(chars.slice(i, i + 74).join(''))
  return parts.join('\r\n ')
}

const compact = (iso) => iso.replaceAll('-', '')

export function toICS(items, now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NextUp//Internship Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Internship deadlines',
  ]
  for (const item of items) {
    if (item.status === 'Rejected' || item.action.daysLeft < 0) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@nextup.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(item.deadline)}`,
      `DTEND;VALUE=DATE:${compact(addDays(item.deadline, 1))}`,
      `SUMMARY:${escapeText(`${item.nextActionMemo ?? item.action.nextStep}: ${item.company}`)}`,
      `DESCRIPTION:${escapeText(`${item.role} · ${item.status}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
