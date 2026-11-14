const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(_req, res, next) {
  res.setHeader('Content-Security-Policy', CSP)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
}

/** Fixed-window rate limit per IP. In memory, which is fine for one instance. */
export function rateLimit({ windowMs, max }) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    if (hits.size > 10_000) hits.clear()
    const key = req.ip ?? 'unknown'
    let entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    entry.count++
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      res.status(429).json({ error: 'Too many requests. Slow down a little.' })
      return
    }
    next()
  }
}

const WORKSPACE_ID = /^[A-Za-z0-9_-]{8,64}$/
export const SHARED_WORKSPACE = 'shared-demo'

/**
 * Workspace from the X-Workspace-Id header. Missing means the shared demo
 * workspace (handy for curl); malformed is rejected.
 */
export function workspaceFrom(req) {
  const header = req.get('x-workspace-id')
  if (header === undefined) return SHARED_WORKSPACE
  return WORKSPACE_ID.test(header) ? header : null
}
