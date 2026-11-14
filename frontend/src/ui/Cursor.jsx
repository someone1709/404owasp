import { useEffect, useRef } from 'react'
import { hasFinePointer, prefersCalm } from '../fx'

/**
 * A trailing ring that grows over anything clickable and can show a label
 * (put data-cursor="Open" on any element). Mouse only; the real cursor stays visible.
 */
export function Cursor() {
  const ring = useRef(null)
  const label = useRef(null)

  useEffect(() => {
    const el = ring.current
    const text = label.current
    if (!el || !text || !hasFinePointer() || prefersCalm()) return

    let x = -100
    let y = -100
    let rx = -100
    let ry = -100
    let raf = 0

    const move = (e) => {
      x = e.clientX
      y = e.clientY
      const t = e.target instanceof Element ? e.target : null
      const hot = !!t?.closest('a, button, select, summary, [role="button"], [role="menuitem"], label.drop, .tile')
      const words = t?.closest('[data-cursor]')?.dataset.cursor ?? ''
      el.dataset.show = '1'
      el.dataset.hot = hot ? '1' : '0'
      el.dataset.label = words ? '1' : '0'
      if (text.textContent !== words) text.textContent = words
    }
    const hide = () => {
      el.dataset.show = '0'
    }
    const tick = () => {
      rx += (x - rx) * 0.22
      ry += (y - ry) * 0.22
      el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(tick)
    }

    document.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', hide)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', hide)
    }
  }, [])

  return (
    <div ref={ring} className="cursor" aria-hidden="true">
      <span ref={label} />
    </div>
  )
}
