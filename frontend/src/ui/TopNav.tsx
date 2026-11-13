import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useRoute } from '../router'
import { Roll } from './Roll'

export interface NavItem {
  path: string
  label: string
  badge?: number
}

interface Spot {
  x: number
  w: number
}

/**
 * Page links with a "magic line": a pill that slides to the current page, plus a softer
 * ghost pill that follows the link under the pointer. Labels roll letter by letter on hover.
 */
export function TopNav({ items }: { items: NavItem[] }) {
  const { path } = useRoute()
  const nav = useRef<HTMLElement>(null)
  const [active, setActive] = useState<Spot | null>(null)
  const [ghost, setGhost] = useState<Spot | null>(null)
  const sig = items.map((i) => `${i.path}:${i.badge ?? 0}`).join('|')

  const measure = useCallback(() => {
    const a = nav.current?.querySelector<HTMLElement>('a[aria-current="page"]')
    setActive(a ? { x: a.offsetLeft, w: a.offsetWidth } : null)
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = nav.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure) // fonts and badges can change widths after first paint
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, path, sig])

  const follow = (target: EventTarget | null) => {
    const a = target instanceof Element ? target.closest<HTMLElement>('a') : null
    setGhost(a ? { x: a.offsetLeft, w: a.offsetWidth } : null)
  }

  return (
    <nav
      ref={nav}
      className="topnav"
      aria-label="Pages"
      onPointerOver={(e) => follow(e.target)}
      onPointerLeave={() => setGhost(null)}
      onFocus={(e) => follow(e.target)}
      onBlur={() => setGhost(null)}
    >
      <span
        className="nav-ghost"
        aria-hidden="true"
        style={ghost ? { transform: `translateX(${ghost.x}px)`, width: ghost.w, opacity: 1 } : { opacity: 0 }}
      />
      <span
        className="nav-pill"
        aria-hidden="true"
        style={active ? { transform: `translateX(${active.x}px)`, width: active.w, opacity: 1 } : { opacity: 0 }}
      />
      {items.map((p) => (
        <Link key={p.path} to={p.path}>
          <Roll>{p.label}</Roll>
          {p.badge ? <span className="nav-count">{p.badge}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
