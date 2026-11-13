// Interaction effects. Everything here is cosmetic, skipped on touch screens and when
// the user prefers reduced motion, and never changes what the app does.

import { useEffect } from 'react'

export const hasFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches
export const prefersCalm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Which elements tilt towards the pointer, and by how many degrees at the edges. */
const TILT_DEG: [string, number][] = [
  ['.tile', 5],
  ['.hero-chart', 3],
  ['.nextup', 3],
  ['.lab-card', 4],
]

/**
 * One delegated pointer listener for:
 *  - a cursor-following glow on .card / .tile / .glow (sets --mx, --my)
 *  - a slight 3D tilt towards the pointer on the elements in TILT_DEG (sets --rx, --ry)
 *  - a magnetic pull on [data-magnetic] (sets --tx, --ty)
 */
export function usePointerFx() {
  useEffect(() => {
    if (!hasFinePointer() || prefersCalm()) return
    let magnet: HTMLElement | null = null

    const release = () => {
      magnet?.style.removeProperty('--tx')
      magnet?.style.removeProperty('--ty')
      magnet = null
    }

    const onMove = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null

      const glow = target?.closest<HTMLElement>('.card, .tile, .glow, .nextup')
      if (glow) {
        const r = glow.getBoundingClientRect()
        const x = e.clientX - r.left
        const y = e.clientY - r.top
        glow.style.setProperty('--mx', `${x}px`)
        glow.style.setProperty('--my', `${y}px`)
        const tilt = TILT_DEG.find(([sel]) => glow.matches(sel))?.[1]
        if (tilt) {
          glow.style.setProperty('--ry', `${((x / r.width) * 2 - 1) * tilt}deg`)
          glow.style.setProperty('--rx', `${((y / r.height) * 2 - 1) * -tilt}deg`)
        }
      }

      const next = target?.closest<HTMLElement>('[data-magnetic]') ?? null
      if (next !== magnet) release()
      if (next) {
        magnet = next
        const r = next.getBoundingClientRect()
        next.style.setProperty('--tx', `${(e.clientX - (r.left + r.width / 2)) * 0.28}px`)
        next.style.setProperty('--ty', `${(e.clientY - (r.top + r.height / 2)) * 0.4}px`)
      }
    }

    const onLeaveTile = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target.closest<HTMLElement>(TILT_DEG.map(([sel]) => sel).join(',')) : null
      if (t) {
        t.style.removeProperty('--rx')
        t.style.removeProperty('--ry')
      }
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onLeaveTile, { passive: true })
    document.documentElement.addEventListener('pointerleave', release)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onLeaveTile)
      document.documentElement.removeEventListener('pointerleave', release)
      release()
    }
  }, [])
}

const CONFETTI_COLOURS = ['#d8ff3d', '#f25438', '#3b82f6', '#8b5cf6', '#14b8a6', '#ffffff']

/** A short burst of confetti for good news (an offer). Self-cleaning, no dependencies. */
export function confetti() {
  if (prefersCalm()) return
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  document.body.appendChild(canvas)

  const bits = Array.from({ length: 150 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 220,
    y: h * 0.62,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 17 - 6,
    size: Math.random() * 7 + 4,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    colour: CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
  }))

  const start = performance.now()
  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, w, h)
    for (const b of bits) {
      b.vy += 0.42
      b.vx *= 0.99
      b.x += b.vx
      b.y += b.vy
      b.rot += b.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - t / 2600)
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      ctx.fillStyle = b.colour
      ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
      ctx.restore()
    }
    if (t < 2600) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}

// ---------- scroll-driven effects ----------

/** What gets the "rise in from depth" reveal when it scrolls into view. */
const REVEAL = [
  '.page-head',
  '.hero-copy',
  '.hero-chart',
  '.ticker',
  '.nextup',
  '.summary .tile',
  '.section-head',
  '.app-card',
  '.side-card',
  '.timeline',
  '.stat',
  '.col',
  '.lab-card',
  '.lab-drop',
  '.callout',
].join(',')

/** What gets live scroll variables (--sp: position in the viewport, --out: how far it has left the top). */
const SCROLL_LINKED = '.hero-copy, .hero-chart, .nextup, .page-head, .app-card'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Scroll choreography, all driven from one rAF loop that only runs while the page moves:
 *  - reveals: elements rise in from depth (3D tilt + blur) the first time they enter the viewport
 *  - depth: elements get --sp / --out so CSS can parallax and tilt them in 3D
 *  - velocity: [data-vel] elements get --vel (smoothed scroll speed) to skew marquees
 *  - progress: [data-progress] elements get --scroll (0..1) and data-show once scrolled
 *  - pins: [data-pin] sections get --pin (0..1 through the pinned stretch) and data-step
 * Skipped entirely with reduced motion; if it never runs, nothing is hidden.
 */
export function useScrollFx() {
  useEffect(() => {
    if (prefersCalm()) return
    const root = document.documentElement
    let io: IntersectionObserver | null = null

    if ('IntersectionObserver' in window) {
      root.classList.add('js-reveal')
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            ;(entry.target as HTMLElement).dataset.in = '1'
            io?.unobserve(entry.target)
          }
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
      )
    }

    let last = window.scrollY
    let vel = 0
    let running = false
    let tagPending = false

    const frame = () => {
      const y = window.scrollY
      const dy = y - last
      last = y
      vel += (clamp(dy / 70, -1, 1) - vel) * 0.16
      const vh = window.innerHeight

      for (const el of document.querySelectorAll<HTMLElement>('[data-vel]')) el.style.setProperty('--vel', vel.toFixed(3))

      const max = root.scrollHeight - vh
      for (const el of document.querySelectorAll<HTMLElement>('[data-progress]')) {
        el.style.setProperty('--scroll', (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4))
        el.dataset.show = y > 480 ? '1' : '0'
      }

      for (const el of document.querySelectorAll<HTMLElement>('[data-scroll]')) {
        const r = el.getBoundingClientRect()
        if (r.bottom < -240 || r.top > vh + 240) continue
        const sp = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1)
        const out = clamp(-r.top / Math.max(r.height, 1), 0, 1)
        el.style.setProperty('--sp', sp.toFixed(3))
        el.style.setProperty('--out', out.toFixed(3))
      }

      for (const el of document.querySelectorAll<HTMLElement>('[data-pin]')) {
        const r = el.getBoundingClientRect()
        const p = clamp(-r.top / Math.max(r.height - vh, 1), 0, 1)
        el.style.setProperty('--pin', p.toFixed(4))
        const step = String(Math.min(4, Math.floor(p * 5)))
        if (el.dataset.step !== step) el.dataset.step = step
      }

      if (Math.abs(vel) > 0.004 || Math.abs(dy) > 0) requestAnimationFrame(frame)
      else running = false
    }

    const kick = () => {
      if (running) return
      running = true
      requestAnimationFrame(frame)
    }

    /** Mark new elements for reveal and scroll variables. Runs whenever React changes the DOM. */
    const tag = () => {
      tagPending = false
      if (io) {
        const order = new Map<Element, number>()
        document.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
          if (el.dataset.reveal) return
          const parent = el.parentElement
          const n = parent ? (order.get(parent) ?? 0) : 0
          if (parent) order.set(parent, n + 1)
          el.dataset.reveal = '1'
          el.style.setProperty('--d', `${Math.min(n, 6) * 80}ms`)
          io?.observe(el)
        })
      }
      document.querySelectorAll<HTMLElement>(SCROLL_LINKED).forEach((el) => {
        if (!el.hasAttribute('data-scroll')) el.setAttribute('data-scroll', '')
      })
      kick()
    }

    const mo = new MutationObserver(() => {
      if (tagPending) return
      tagPending = true
      requestAnimationFrame(tag)
    })
    const rootEl = document.getElementById('root')
    if (rootEl) mo.observe(rootEl, { childList: true, subtree: true })

    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    tag()
    return () => {
      mo.disconnect()
      io?.disconnect()
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
      root.classList.remove('js-reveal')
    }
  }, [])
}
