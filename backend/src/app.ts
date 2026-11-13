import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { isValidISODate, serverToday } from './dates.ts'
import { toICS } from './ics.ts'
import { buildDashboard, present } from './rules.ts'
import { rateLimit, securityHeaders, workspaceFrom } from './security.ts'
import { createStore } from './store.ts'
import type { StoreOptions } from './store.ts'
import { isStatus, validateDraft, validateMemo } from './validation.ts'

export interface AppOptions extends StoreOptions {
  frontendDir?: string // built frontend to serve; skipped if it doesn't exist
  rateLimitPerMinute?: number
}

/** Who is asking and what day it is for them. Sends a 400 and returns null if invalid. */
function context(req: Request, res: Response): { ws: string; today: string } | null {
  const ws = workspaceFrom(req)
  if (!ws) {
    res.status(400).json({ error: 'Invalid X-Workspace-Id header' })
    return null
  }
  const today = isValidISODate(req.query.today) ? req.query.today : serverToday()
  return { ws, today }
}

export function createApp({
  frontendDir = join(import.meta.dirname, '../../frontend/dist'),
  rateLimitPerMinute = 600,
  ...storeOptions
}: AppOptions = {}) {
  const store = createStore(storeOptions)
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1) // Render and most hosts sit behind one proxy
  app.use(securityHeaders)
  app.use('/api', rateLimit({ windowMs: 60_000, max: rateLimitPerMinute }))
  app.use(express.json({ limit: '20kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/dashboard', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    res.json(buildDashboard(store.list(ctx.ws, ctx.today), ctx.today))
  })

  app.post('/api/applications', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    const result = validateDraft(req.body, ctx.today)
    if (!result.ok) {
      res.status(400).json({ errors: result.errors })
      return
    }
    const record = store.create(ctx.ws, ctx.today, result.draft)
    if (!record) {
      res.status(409).json({ error: 'You have reached the limit of 200 applications' })
      return
    }
    res.status(201).json(present(record, ctx.today))
  })

  app.put('/api/applications/:id', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    const result = validateDraft(req.body, ctx.today)
    if (!result.ok) {
      res.status(400).json({ errors: result.errors })
      return
    }
    const record = store.update(ctx.ws, ctx.today, req.params.id, result.draft)
    if (!record) {
      res.status(404).json({ error: 'Application not found' })
      return
    }
    res.json(present(record, ctx.today))
  })

  app.patch('/api/applications/:id/status', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    const status = req.body?.status
    if (!isStatus(status)) {
      res.status(400).json({ errors: { status: 'Choose a valid status' } })
      return
    }
    const record = store.setStatus(ctx.ws, ctx.today, req.params.id, status)
    if (!record) {
      res.status(404).json({ error: 'Application not found' })
      return
    }
    res.json(present(record, ctx.today))
  })

  app.patch('/api/applications/:id/memo', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    const result = validateMemo(req.body?.nextActionMemo)
    if (!result.ok) {
      res.status(400).json({ errors: { nextActionMemo: result.error } })
      return
    }
    const record = store.setMemo(ctx.ws, ctx.today, req.params.id, result.memo)
    if (!record) {
      res.status(404).json({ error: 'Application not found' })
      return
    }
    res.json(present(record, ctx.today))
  })

  app.delete('/api/applications/:id', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    if (!store.remove(ctx.ws, ctx.today, req.params.id)) {
      res.status(404).json({ error: 'Application not found' })
      return
    }
    res.json({ id: req.params.id })
  })

  app.post('/api/applications/:id/restore', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    const record = store.restore(ctx.ws, ctx.today, req.params.id)
    if (!record) {
      res.status(404).json({ error: 'Nothing to restore' })
      return
    }
    res.json(present(record, ctx.today))
  })

  app.delete('/api/applications', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    store.wipe(ctx.ws)
    res.status(204).end()
  })

  app.post('/api/demo/reset', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    store.reset(ctx.ws, ctx.today)
    res.status(204).end()
  })

  app.get('/api/export.ics', (req, res) => {
    const ctx = context(req, res)
    if (!ctx) return
    const { items } = buildDashboard(store.list(ctx.ws, ctx.today), ctx.today)
    res.type('text/calendar; charset=utf-8')
    res.attachment('internship-deadlines.ics')
    res.send(toICS(items))
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // One URL for everything: serve the built frontend when it exists.
  if (existsSync(join(frontendDir, 'index.html'))) {
    app.use(express.static(frontendDir))
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next()
      res.sendFile(join(frontendDir, 'index.html'))
    })
  }

  // Never leak stack traces to the client.
  app.use((err: { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body must be valid JSON' })
      return
    }
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body is too large' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  })

  return app
}
