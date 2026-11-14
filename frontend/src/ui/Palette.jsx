import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'

import { Kbd } from './TopNav'

/** Ctrl/Cmd+K: jump to any page, run any action, or open any application. */
export function Palette({ open, onClose, items }) {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef(null)
  const list = useRef(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setAt(0)
    input.current?.focus()
  }, [open])

  // Esc closes it even if focus has moved off the input.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const shown = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
    return items.filter((it) => {
      const hay = `${it.label} ${it.hint ?? ''} ${it.group}`.toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
  }, [items, q])

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [at, shown])

  if (!open) return null

  const run = (it) => {
    if (!it) return
    onClose()
    setTimeout(it.run, 60)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAt((a) => Math.min(a + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(shown[at])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="palette-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={q}
            maxLength={60}
            placeholder="Jump to a page, run an action, find an application…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            onChange={(e) => {
              setQ(e.target.value)
              setAt(0)
            }}
            onKeyDown={onKey}
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul id="palette-list" className="palette-list" role="listbox" ref={list}>
          {shown.length === 0 && <li className="palette-empty">Nothing matches “{q}”</li>}
          {shown.map((it, i) => (
            <li key={it.id} role="presentation">
              {(i === 0 || shown[i - 1].group !== it.group) && <p className="palette-group">{it.group}</p>}
              <button
                type="button"
                role="option"
                aria-selected={i === at}
                className="palette-item"
                onMouseMove={() => setAt(i)}
                onClick={() => run(it)}
              >
                <Icon name={it.icon} size={16} />
                <span className="palette-label">{it.label}</span>
                {it.hint && <span className="palette-hint">{it.hint}</span>}
              </button>
            </li>
          ))}
        </ul>

        <p className="palette-foot">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> move · <Kbd>Enter</Kbd> select
        </p>
      </div>
    </div>
  )
}
