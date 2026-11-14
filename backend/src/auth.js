// Optional accounts. Without signing in the app works exactly as before (a private workspace per browser).
// Signing in ties the data to the account, so it follows you across browsers and devices.
//
//   POST /api/auth/register   { email, password, name? }   -> 201 { user }, sets the session cookie
//   POST /api/auth/login      { email, password }          -> 200 { user }, sets the session cookie
//   POST /api/auth/logout                                  -> 204, ends the session
//   GET  /api/auth/me                                      -> { user } or { user: null }
//   GET  /api/me/data         (signed in)                  -> everything stored about you
//
// Security choices: passwords are scrypt-hashed with a per-user salt (passwords.js); the session token is
// 32 random bytes in an HttpOnly, SameSite=Lax cookie and only its SHA-256 hash is stored; login failures
// are one generic message and take the same time whether or not the email exists; attempts are rate limited.

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import express from 'express'

import { dummyHash, hashPassword, verifyPassword } from './passwords.js'
import { rateLimit } from './security.js'

export const SESSION_COOKIE = 'nextup_session'
const SESSION_SECONDS = 14 * 24 * 60 * 60
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/ // 32 random bytes, base64url
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g

export const LIMITS = { email: 254, name: 60, passwordMin: 8, passwordMax: 128 }

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function parseCookies(header = '') {
  const jar = {}
  for (const part of header.split(';')) {
    const at = part.indexOf('=')
    if (at > 0) jar[part.slice(0, at).trim()] = part.slice(at + 1).trim()
  }
  return jar
}

const publicUser = (u) => ({ id: u.id ?? u._id, email: u.email, ...(u.name ? { name: u.name } : {}) })

/** Check the sign-up / sign-in fields. Returns { ok: true, value } or { ok: false, errors }. */
export function validateCredentials(body, { signUp }) {
  const input = body && typeof body === 'object' ? body : {}
  const errors = {}

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!email) errors.email = 'Email is required'
  else if (email.length > LIMITS.email || !EMAIL_SHAPE.test(email)) errors.email = 'Enter a valid email address'

  const password = typeof input.password === 'string' ? input.password : ''
  if (!password) errors.password = 'Password is required'
  else if (signUp && password.length < LIMITS.passwordMin) errors.password = `Use at least ${LIMITS.passwordMin} characters`
  else if (password.length > LIMITS.passwordMax) errors.password = `Keep it under ${LIMITS.passwordMax} characters`

  const name = typeof input.name === 'string' ? input.name.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim() : ''
  if (signUp && name.length > LIMITS.name) errors.name = `Keep it under ${LIMITS.name} characters`

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { email, password, name } }
}

/** Reads the session cookie and sets req.user (or null). Never blocks the request. */
export function attachUser(authStore) {
  return async (req, _res, next) => {
    req.user = null
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (token && TOKEN_SHAPE.test(token)) {
      try {
        const session = await authStore.findSession(sha256(token))
        if (session) req.user = { id: session.userId, email: session.email, name: session.name, session: session._id }
      } catch (err) {
        console.error('Could not look up the session; treating the request as signed out:', err)
      }
    }
    next()
  }
}

/** Cookies are sent along with cross-site requests in some cases, so refuse state changes from other origins. */
export function sameOrigin(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin')
    let ok = true
    if (origin) {
      try {
        ok = new URL(origin).host === req.get('host')
      } catch {
        ok = false
      }
    }
    if (!ok) return res.status(403).json({ error: 'Cross-site request blocked' })
  }
  next()
}

export function authRouter({ authStore, attemptsPerMinute = 30 }) {
  const router = express.Router()
  const limit = rateLimit({ windowMs: 60_000, max: attemptsPerMinute })
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' })

  async function startSession(req, res, user) {
    const token = randomBytes(32).toString('base64url')
    const now = Date.now()
    await authStore.createSession({
      _id: sha256(token),
      userId: user._id,
      email: user.email,
      name: user.name,
      createdAt: new Date(now),
      expiresAt: new Date(now + SESSION_SECONDS * 1000),
    })
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_SECONDS * 1000 })
  }

  router.post('/register', limit, async (req, res, next) => {
    try {
      const checked = validateCredentials(req.body, { signUp: true })
      if (!checked.ok) return res.status(400).json({ errors: checked.errors })
      const { email, password, name } = checked.value
      const user = await authStore.createUser({
        _id: randomUUID(),
        email,
        name,
        passwordHash: await hashPassword(password),
        createdAt: new Date(),
      })
      if (!user) return res.status(409).json({ errors: { email: 'That email is already registered. Try signing in.' } })
      await startSession(req, res, user)
      res.status(201).json({ user: publicUser(user) })
    } catch (err) {
      next(err)
    }
  })

  router.post('/login', limit, async (req, res, next) => {
    try {
      const checked = validateCredentials(req.body, { signUp: false })
      if (!checked.ok) return res.status(400).json({ errors: checked.errors })
      const { email, password } = checked.value
      const user = await authStore.findUserByEmail(email)
      // Hash against a dummy when the account doesn't exist, so timing doesn't reveal which emails are registered.
      const valid = await verifyPassword(password, user ? user.passwordHash : await dummyHash())
      if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password' })
      await startSession(req, res, user)
      res.json({ user: publicUser(user) })
    } catch (err) {
      next(err)
    }
  })

  router.post('/logout', async (req, res, next) => {
    try {
      if (req.user) await authStore.deleteSession(req.user.session)
      res.clearCookie(SESSION_COOKIE, cookieOptions(req))
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  router.get('/me', (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null })
  })

  return router
}
