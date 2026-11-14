import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { Link, useRoute } from '../router'

import { Kbd } from './TopNav'
import { Roll } from './Roll'

/** Topographic contour lines, generated: a few wobbly rings around a point. */
function Contours() {
  const rings = useMemo(
    () =>
      Array.from({ length: 11 }, (_, k) => {
        const r = 70 + k * 46
        const pts = Array.from({ length: 90 }, (_, i) => {
          const a = (i / 90) * Math.PI * 2
          const wobble = 1 + 0.16 * Math.sin(3 * a + k * 0.7) + 0.09 * Math.cos(5 * a - k * 0.4)
          return `${(500 + Math.cos(a) * r * 1.55 * wobble).toFixed(1)},${(380 + Math.sin(a) * r * wobble).toFixed(1)}`
        })
        return `M${pts.join('L')}Z`
      }),
    [],
  )
  return (
    <svg className="contours" viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {rings.map((d, i) => (
        <path key={i} d={d} style={{ '--i': i }} />
      ))}
    </svg>
  )
}

/** Full-screen menu: huge type links, a neon squiggle on the current page, a "next deadline" widget. */
export function MenuOverlay({ open, onClose, pages, next, onOpenNext, onNew, onPalette, onExport, onTheme, dark }) {
  const { path } = useRoute()
  const [mounted, setMounted] = useState(open)
  const root = useRef(null)
  const opener = useRef(null)

  // Keep it in the DOM for the closing animation, then drop it.
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement
      setMounted(true)
      return
    }
    const t = setTimeout(() => setMounted(false), 380)
    return () => clearTimeout(t)
  }, [open])

  // The close handler is an inline function in the parent; keep the latest in a ref so the
  // effect below doesn't re-run (and steal focus) on every parent render.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open || !mounted) return
    root.current?.querySelector('.mo-link')?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, mounted])

  // Give focus back to whatever opened the menu once it has closed.
  useEffect(() => {
    if (!open && opener.current instanceof HTMLElement) opener.current.focus()
  }, [open])

  if (!mounted) return null

  const act = (fn) => () => {
    onClose()
    setTimeout(fn, 120)
  }

  return (
    <div
      ref={root}
      className="menu-overlay"
      data-state={open ? 'open' : 'closing'}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <Contours />

      <header className="mo-top">
        <span className="mo-brand">
          <Icon name="logo" size={20} /> NextUp
        </span>
        <button type="button" className="btn neon" onClick={onClose} data-magnetic>
          <Roll>Close</Roll>
          <Icon name="x" size={16} />
        </button>
      </header>

      <nav className="mo-nav" aria-label="Pages">
        <ol className="mo-list">
          {pages.map((p, i) => (
            <li key={p.path} style={{ '--i': i }}>
              <Link to={p.path} className="mo-link" onClick={onClose} data-cursor="Go">
                <span className="mo-n mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="mo-label" data-current={path === p.path}>
                  <Roll>{p.label}</Roll>
                </span>
                <span className="mo-end">
                  <span className="mo-meta">{p.meta}</span>
                  <Icon name="arrow" size={26} className="mo-arrow" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <aside className="mo-side">
        {next && (
          <button type="button" className="mo-next" onClick={act(() => onOpenNext(next.id))} data-cursor="Open">
            <span className="mo-next-k">Next deadline</span>
            <strong>{next.company}</strong>
            <span className="mo-next-v mono">
              {next.daysLeft < 0 ? `${-next.daysLeft}d overdue` : next.daysLeft === 0 ? 'due today' : `in ${next.daysLeft}d`}
            </span>
          </button>
        )}
      </aside>

      <footer className="mo-foot">
        <div className="mo-actions">
          <button type="button" className="mo-pill" onClick={act(onNew)}>
            <Icon name="plus" size={14} /> New application
          </button>
          <button type="button" className="mo-pill" onClick={act(onPalette)}>
            <Icon name="search" size={14} /> Search
          </button>
          <button type="button" className="mo-pill" onClick={act(onExport)}>
            <Icon name="download" size={14} /> Export .ics
          </button>
          <button type="button" className="mo-pill" onClick={onTheme}>
            <Icon name={dark ? 'sun' : 'moon'} size={14} /> {dark ? 'Light' : 'Dark'} mode
          </button>
        </div>
        <p className="mo-keys">
          <Kbd>N</Kbd> new · <Kbd>/</Kbd> search · <Kbd>M</Kbd> menu · <Kbd>1</Kbd>–<Kbd>5</Kbd> pages · <Kbd>Esc</Kbd> close
        </p>
      </footer>
    </div>
  )
}
