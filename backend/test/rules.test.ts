import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { addDays, diffDays, isValidISODate, timestampOn } from '../src/dates.ts'
import { toICS } from '../src/ics.ts'
import { buildInsights } from '../src/insights.ts'
import { computeAction, present } from '../src/rules.ts'
import { seedApplications } from '../src/seed.ts'
import type { ApplicationRecord, Status } from '../src/types.ts'
import { validateDraft } from '../src/validation.ts'

const TODAY = '2026-11-13'

function record(status: Status, deadlineIn: number, lastChangeDaysAgo = 1): ApplicationRecord {
  const at = timestampOn(addDays(TODAY, -lastChangeDaysAgo))
  return {
    id: 'x',
    company: 'Acme',
    role: 'SDE Intern',
    deadline: addDays(TODAY, deadlineIn),
    status,
    history: [{ status, at }],
    source: 'Campus',
    resumeVersion: 'v1',
    companyType: 'Product',
    createdAt: at,
  }
}

describe('dates', () => {
  test('crosses month and year boundaries', () => {
    assert.equal(addDays('2026-11-30', 1), '2026-12-01')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
    assert.equal(diffDays('2026-11-13', '2026-11-16'), 3)
  })

  test('rejects impossible dates', () => {
    assert.equal(isValidISODate('2026-02-30'), false)
    assert.equal(isValidISODate('13/11/2026'), false)
    assert.equal(isValidISODate('2026-11-13'), true)
  })
})

describe('computeAction', () => {
  test('deadline within 3 days is a warning and needs action', () => {
    for (const [days, badge] of [[0, 'Due today'], [1, 'Due tomorrow'], [2, 'Due in 2 days'], [3, 'Due in 3 days']] as const) {
      const a = computeAction(record('Applied', days), TODAY)
      assert.equal(a.severity, 'soon')
      assert.equal(a.needsAction, true)
      assert.equal(a.badge, badge)
    }
  })

  test('day 4 is no longer urgent', () => {
    const a = computeAction(record('Test', 4), TODAY)
    assert.equal(a.severity, 'ok')
    assert.equal(a.needsAction, false)
    assert.equal(a.reason, null)
  })

  test('reason matches the stage', () => {
    assert.equal(computeAction(record('Test', 2), TODAY).reason, 'Online test due in 2 days')
    assert.equal(computeAction(record('Interview', 1), TODAY).reason, 'Interview tomorrow')
    assert.equal(computeAction(record('Interview', -1), TODAY).reason, 'Interview was yesterday')
  })

  test('past deadline is overdue and most urgent', () => {
    const overdue = computeAction(record('Test', -2), TODAY)
    assert.equal(overdue.severity, 'overdue')
    assert.equal(overdue.badge, 'Overdue by 2 days')
    assert.ok(overdue.urgency > computeAction(record('Test', 0), TODAY).urgency)
  })

  test('no reply for 14+ days after applying needs a follow-up', () => {
    const stale = computeAction(record('Applied', 20, 14), TODAY)
    assert.equal(stale.severity, 'stale')
    assert.equal(stale.badge, 'No reply in 14 days')
    assert.equal(computeAction(record('Applied', 20, 13), TODAY).severity, 'ok')
  })

  test('rejected applications never need action', () => {
    const a = computeAction(record('Rejected', -5), TODAY)
    assert.equal(a.severity, 'closed')
    assert.equal(a.needsAction, false)
  })
})

describe('insights on demo data', () => {
  const insights = buildInsights(seedApplications(TODAY))

  test('funnel counts everyone who reached each stage', () => {
    assert.deepEqual(insights.funnel.map((f) => f.count), [13, 10, 5, 1])
  })

  test('finds the drop-off stage, best source and best resume', () => {
    const texts = insights.messages.map((m) => m.text)
    assert.match(texts[0], /3 of 5 rejections came after the online test, all at Product companies/)
    assert.match(texts[1], /^Referral .* 75% .* 0% for Job board/)
    assert.match(texts[2], /v2-backend.* 80% .* 13% for "v1-general"/)
  })

  test('small data shows a hint instead of a guess', () => {
    const insights = buildInsights([record('Applied', 5)])
    assert.equal(insights.messages[0].tone, 'info')
  })
})

describe('validateDraft', () => {
  test('trims, strips control characters and fills defaults', () => {
    const result = validateDraft({ company: '  Acme\u0000 Corp ', role: 'SDE', deadline: '2026-11-15' }, TODAY)
    assert.ok(result.ok)
    assert.equal(result.draft.company, 'Acme Corp')
    assert.equal(result.draft.status, 'Applied')
    assert.equal(result.draft.resumeVersion, 'v1-general')
  })

  test('blocks javascript: links and silly dates', () => {
    const result = validateDraft({ company: 'A', role: 'B', deadline: '2030-01-01', link: 'javascript:alert(1)' }, TODAY)
    assert.equal(result.ok, false)
    assert.ok(!result.ok && result.errors.link && result.errors.deadline)
  })
})

test('ICS escapes text and skips closed items', () => {
  const open = present({ ...record('Test', 2), company: 'Comma, Semi; Co' }, TODAY)
  const closed = present({ ...record('Rejected', 2), company: 'Gone Ltd' }, TODAY)
  const ics = toICS([open, closed])
  assert.match(ics, /SUMMARY:Finish the online test: Comma\\, Semi\\; Co/)
  assert.doesNotMatch(ics, /Gone Ltd/)
  assert.match(ics, /DTSTART;VALUE=DATE:20261115/)
})
