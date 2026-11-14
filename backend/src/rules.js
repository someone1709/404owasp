// The "what needs action next" engine. Every rule lives here so the
// minute-40 twist usually means changing one function, not the whole app.

import { addDays, daysSince, diffDays, formatShort, plural } from './dates.js'
import { buildInsights } from './insights.js'
import { STATUSES } from './types.js'

export const DUE_SOON_DAYS = 3 // "deadline within three days" from the judge path
export const STALE_DAYS = 14 // no reply this long after applying = follow up
export const UPCOMING_DAYS = 14

const NEXT_STEP = {
  Applied: 'Wait for a reply',
  Test: 'Finish the online test',
  Interview: 'Prepare for the interview',
  Offer: 'Reply to the offer',
  Rejected: 'Closed — note what to improve',
}

/** What the deadline means at each stage, e.g. "Online test due tomorrow". */
const DEADLINE_LABEL = {
  Applied: 'Deadline',
  Test: 'Online test due',
  Interview: 'Interview',
  Offer: 'Offer reply due',
  Rejected: 'Deadline',
}

/** The same, once the date has passed, e.g. "Interview was yesterday". */
const MISSED_LABEL = {
  Applied: 'Deadline passed',
  Test: 'Online test deadline passed',
  Interview: 'Interview was',
  Offer: 'Offer reply deadline passed',
  Rejected: 'Deadline passed',
}

function inDays(days) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function daysAgo(days) {
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function lastChange(record) {
  return record.history.at(-1)?.at ?? record.createdAt
}

export function computeAction(record, today) {
  const daysLeft = diffDays(today, record.deadline)
  const { status } = record

  if (status === 'Rejected') {
    return {
      needsAction: false,
      severity: 'closed',
      badge: 'Closed',
      reason: null,
      nextStep: NEXT_STEP.Rejected,
      daysLeft,
      urgency: 0,
    }
  }

  if (daysLeft < 0) {
    const late = -daysLeft
    return {
      needsAction: true,
      severity: 'overdue',
      badge: `Overdue by ${plural(late, 'day')}`,
      reason: `${MISSED_LABEL[status]} ${daysAgo(late)}`,
      nextStep: 'Update the status or set a new deadline',
      daysLeft,
      urgency: 100 + Math.min(late, 30),
    }
  }

  if (daysLeft <= DUE_SOON_DAYS) {
    return {
      needsAction: true,
      severity: 'soon',
      badge: daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `Due in ${daysLeft} days`,
      reason: `${DEADLINE_LABEL[status]} ${inDays(daysLeft)}`,
      nextStep: NEXT_STEP[status],
      daysLeft,
      urgency: 90 - daysLeft * 10,
    }
  }

  const quietDays = daysSince(lastChange(record), today)
  if (status === 'Applied' && quietDays >= STALE_DAYS) {
    return {
      needsAction: true,
      severity: 'stale',
      badge: `No reply in ${quietDays} days`,
      reason: `No reply in ${quietDays} days since you applied`,
      nextStep: 'Send a polite follow-up email',
      daysLeft,
      urgency: 40 + Math.min(quietDays - STALE_DAYS, 10),
    }
  }

  return {
    needsAction: false,
    severity: 'ok',
    badge: `Due ${formatShort(record.deadline)}`,
    reason: null,
    nextStep: NEXT_STEP[status],
    daysLeft,
    urgency: Math.max(1, 30 - daysLeft),
  }
}

/** Store record -> API shape (drops internal fields, adds the computed action). */
export function present(record, today) {
  const { deletedAt: _deletedAt, ...rest } = record
  return { ...rest, action: computeAction(record, today) }
}

export function byUrgency(a, b) {
  return b.action.urgency - a.action.urgency || a.deadline.localeCompare(b.deadline) || a.company.localeCompare(b.company)
}

export function summarize(items) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  for (const item of items) counts[item.status]++
  return {
    counts,
    total: items.length,
    active: items.length - counts.Rejected,
    needsAction: items.filter((i) => i.action.needsAction).length,
  }
}

export function upcomingDeadlines(items, today) {
  const horizon = addDays(today, UPCOMING_DAYS)
  return items
    .filter((i) => i.status !== 'Rejected' && i.deadline <= horizon)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((i) => ({
      id: i.id,
      company: i.company,
      role: i.role,
      deadline: i.deadline,
      daysLeft: i.action.daysLeft,
      severity: i.action.severity,
    }))
}

export function buildDashboard(records, today) {
  const items = records.map((r) => present(r, today)).sort(byUrgency)
  return {
    today,
    items,
    summary: summarize(items),
    deadlines: upcomingDeadlines(items, today),
    insights: buildInsights(records),
  }
}
