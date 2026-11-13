import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, test } from 'node:test'
import { createApp } from '../src/app.ts'
import { addDays } from '../src/dates.ts'
import type { Application, Dashboard } from '../src/types.ts'

const TODAY = '2026-11-13'
let base = ''
let close = () => {}

before(async () => {
  const server = createApp({ frontendDir: '/nonexistent' }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://localhost:${(server.address() as AddressInfo).port}/api`
  close = () => server.close()
})
after(() => close())

let wsCounter = 0
const newWorkspace = () => `test-workspace-${++wsCounter}`

async function call(ws: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}?today=${TODAY}`, {
    method,
    headers: { 'X-Workspace-Id': ws, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined }
}

const dashboard = async (ws: string) => (await call(ws, 'GET', '/dashboard')).body as Dashboard

describe('judge verification path', () => {
  const ws = newWorkspace()
  let created: Application

  test('starts with demo data', async () => {
    const d = await dashboard(ws)
    assert.equal(d.summary.total, 13)
    assert.equal(d.summary.needsAction, 4)
    assert.equal(d.items[0].company, 'Pebble Health') // overdue goes first
  })

  test('step 1: create an application due within three days', async () => {
    const res = await call(ws, 'POST', '/applications', {
      company: 'Zephyr Robotics',
      role: 'Embedded Intern',
      deadline: addDays(TODAY, 2),
    })
    assert.equal(res.status, 201)
    created = res.body
    assert.equal(created.action.badge, 'Due in 2 days')
    assert.equal(created.action.severity, 'soon')
  })

  test('step 2: it shows up in needs action and upcoming deadlines', async () => {
    const d = await dashboard(ws)
    assert.equal(d.summary.needsAction, 5)
    assert.ok(d.items.find((i) => i.id === created.id)?.action.needsAction)
    assert.ok(d.deadlines.some((x) => x.id === created.id))
  })

  test('step 3: changing status updates the summary counts', async () => {
    const before = (await dashboard(ws)).summary.counts
    const res = await call(ws, 'PATCH', `/applications/${created.id}/status`, { status: 'Interview' })
    assert.equal(res.status, 200)
    assert.equal(res.body.history.length, 2)
    const after = (await dashboard(ws)).summary.counts
    assert.equal(after.Applied, before.Applied - 1)
    assert.equal(after.Interview, before.Interview + 1)
  })
})

describe('validation and security', () => {
  const ws = newWorkspace()

  test('missing fields return per-field errors', async () => {
    const res = await call(ws, 'POST', '/applications', {})
    assert.equal(res.status, 400)
    assert.deepEqual(Object.keys(res.body.errors).sort(), ['company', 'deadline', 'role'])
  })

  test('javascript: links and unknown statuses are rejected', async () => {
    const res = await call(ws, 'POST', '/applications', {
      company: 'A', role: 'B', deadline: TODAY, link: 'javascript:alert(1)', status: 'Hired',
    })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.link && res.body.errors.status)
  })

  test('clients cannot set id, history or createdAt', async () => {
    const res = await call(ws, 'POST', '/applications', {
      company: 'A', role: 'B', deadline: TODAY, id: 'hacked', createdAt: '2000-01-01', history: [],
    })
    assert.equal(res.status, 201)
    assert.notEqual(res.body.id, 'hacked')
    assert.notEqual(res.body.createdAt, '2000-01-01')
    assert.equal(res.body.history.length, 1)
  })

  test('HTML is stored as plain text, untouched', async () => {
    const payload = '<img src=x onerror=alert(1)>'
    const res = await call(ws, 'POST', '/applications', { company: payload, role: 'B', deadline: TODAY })
    assert.equal(res.body.company, payload)
  })

  test('workspaces are isolated', async () => {
    const other = await dashboard(newWorkspace())
    assert.equal(other.summary.total, 13)
    assert.ok(!other.items.some((i) => i.company === 'A'))
    assert.equal((await call('bad id!', 'GET', '/dashboard')).status, 400)
  })

  test('bad JSON gets a clean 400, and security headers are set', async () => {
    const res = await fetch(`${base}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{oops',
    })
    assert.equal(res.status, 400)
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('x-powered-by'), null)
  })
})

describe('minute-40 twist', () => {
  const ws = newWorkspace()

  test('three-day warning: only deadlines within 72 hours are flagged, alongside overdue and follow-ups', async () => {
    for (const days of [0, 3, 4]) {
      await call(ws, 'POST', '/applications', { company: `Day ${days} Co`, role: 'Intern', deadline: addDays(TODAY, days) })
    }
    const d = await dashboard(ws)
    const flagged = (name: string) => d.items.find((i) => i.company === name)!.action
    assert.equal(flagged('Day 0 Co').severity, 'soon')
    assert.equal(flagged('Day 3 Co').severity, 'soon')
    assert.equal(flagged('Day 4 Co').needsAction, false)
    const needsAction = d.items.filter((i) => i.action.needsAction)
    assert.equal(needsAction.length, d.summary.needsAction)
    assert.ok(needsAction.every((i) => ['soon', 'overdue', 'stale'].includes(i.action.severity)))
  })

  test('next-action memo can be set on create, edited, and cleared', async () => {
    const created = (await call(ws, 'POST', '/applications', {
      company: 'Memo Co', role: 'Intern', deadline: addDays(TODAY, 2), nextActionMemo: '  Email HR  ',
    })).body as Application
    assert.equal(created.nextActionMemo, 'Email HR')

    const edited = await call(ws, 'PATCH', `/applications/${created.id}/memo`, { nextActionMemo: 'Book a mock interview' })
    assert.equal(edited.status, 200)
    assert.equal(edited.body.nextActionMemo, 'Book a mock interview')
    const inDashboard = (await dashboard(ws)).items.find((i) => i.id === created.id)
    assert.equal(inDashboard?.nextActionMemo, 'Book a mock interview')

    const cleared = await call(ws, 'PATCH', `/applications/${created.id}/memo`, { nextActionMemo: '' })
    assert.equal(cleared.body.nextActionMemo, undefined)
    assert.equal(cleared.body.action.nextStep, 'Wait for a reply') // falls back to the suggestion
  })

  test('memo is validated', async () => {
    const id = (await dashboard(ws)).items[0].id
    assert.equal((await call(ws, 'PATCH', `/applications/${id}/memo`, { nextActionMemo: 'x'.repeat(141) })).status, 400)
    assert.equal((await call(ws, 'PATCH', `/applications/${id}/memo`, { nextActionMemo: 42 })).status, 400)
    assert.equal((await call(ws, 'PATCH', '/applications/nope/memo', { nextActionMemo: 'hi' })).status, 404)
  })

  test('demo data ships with memos, and the calendar uses them', async () => {
    const pebble = (await dashboard(ws)).items.find((i) => i.company === 'Pebble Health')
    assert.equal(pebble?.nextActionMemo, 'Email the placement cell for a new test link')
    const ics = await (await fetch(`${base}/export.ics?today=${TODAY}`, { headers: { 'X-Workspace-Id': ws } })).text()
    assert.match(ics, /SUMMARY:Revise graphs \+ DP/)
  })
})

describe('edit, delete, undo, reset, export', () => {
  const ws = newWorkspace()

  test('edit replaces fields and records status changes', async () => {
    const id = (await dashboard(ws)).items[0].id
    const res = await call(ws, 'PUT', `/applications/${id}`, {
      company: 'Renamed', role: 'ML Intern', deadline: addDays(TODAY, 10), status: 'Interview',
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.company, 'Renamed')
    assert.equal(res.body.action.severity, 'ok')
    assert.equal(res.body.history.at(-1).status, 'Interview')
  })

  test('delete then undo', async () => {
    const id = (await dashboard(ws)).items[0].id
    assert.equal((await call(ws, 'DELETE', `/applications/${id}`)).status, 200)
    assert.equal((await dashboard(ws)).summary.total, 12)
    assert.equal((await call(ws, 'POST', `/applications/${id}/restore`)).status, 200)
    assert.equal((await dashboard(ws)).summary.total, 13)
    assert.equal((await call(ws, 'DELETE', '/applications/nope')).status, 404)
  })

  test('calendar export lists open deadlines', async () => {
    const res = await fetch(`${base}/export.ics?today=${TODAY}`, { headers: { 'X-Workspace-Id': ws } })
    assert.match(res.headers.get('content-type') ?? '', /text\/calendar/)
    const ics = (await res.text()).replace(/\r\n /g, '') // unfold wrapped lines
    assert.match(ics, /BEGIN:VCALENDAR/)
    assert.match(ics, /Nimbus Labs/)
    assert.doesNotMatch(ics, /Tessellate AI/) // rejected
  })

  test('wipe empties the workspace, reset brings the demo back', async () => {
    await call(ws, 'DELETE', '/applications')
    assert.equal((await dashboard(ws)).summary.total, 0)
    await call(ws, 'POST', '/demo/reset')
    assert.equal((await dashboard(ws)).summary.total, 13)
  })
})
