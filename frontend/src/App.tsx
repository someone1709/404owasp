import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { Icon } from './icons'
import type { IconName } from './icons'
import type { Application, Dashboard, Status } from './types'
import { AppCard } from './ui/Card'
import { AppForm } from './ui/Form'
import { FilterBar, Hero, SummaryTiles } from './ui/Overview'
import type { Filter } from './ui/Overview'
import { Deadlines, Insights } from './ui/Side'

type Theme = 'light' | 'dark'
interface Toast {
  key: number
  text: string
  tone: 'info' | 'error'
  undo?: () => void
  ms: number
}

const THEME_KEY = 'nextup:theme'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage blocked: fall through to the system setting */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function App() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ editing: Application | null } | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // ----- data -----

  const reload = useCallback(async () => {
    try {
      const d = await api.dashboard()
      setData(d)
      setLoadError('')
      return d
    } catch (e) {
      setLoadError(errorText(e))
      return null
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const showToast = useCallback((text: string, opts: Partial<Omit<Toast, 'key' | 'text'>> = {}) => {
    setToast({ key: Date.now(), text, tone: opts.tone ?? 'info', undo: opts.undo, ms: opts.ms ?? 3500 })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.ms)
    return () => clearTimeout(t)
  }, [toast])

  /** Run a change, then refetch the dashboard (the spec's golden rule). */
  async function mutate(change: () => Promise<unknown>, done?: () => void) {
    try {
      await change()
      await reload()
      done?.()
    } catch (e) {
      await reload()
      showToast(errorText(e), { tone: 'error' })
    }
  }

  // ----- theme & menu -----

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  /** Only an explicit toggle is remembered; otherwise follow the system setting. */
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* not critical */
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [menuOpen])

  // ----- list -----

  const visible = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.items.filter((i) => {
      if (filter === 'action' && !i.action.needsAction) return false
      if (filter !== 'all' && filter !== 'action' && i.status !== filter) return false
      return !q || i.company.toLowerCase().includes(q) || i.role.toLowerCase().includes(q)
    })
  }, [data, filter, query])

  const resumeVersions = useMemo(
    () => [...new Set(['v1-general', ...(data?.items.map((i) => i.resumeVersion) ?? [])])],
    [data],
  )

  /** Scroll to a card and flash it, clearing filters that would hide it. */
  const jumpTo = useCallback(
    (id: string) => {
      if (!visible.some((i) => i.id === id)) {
        setFilter('all')
        setQuery('')
      }
      setFlash({ id, n: Date.now() })
    },
    [visible],
  )

  useEffect(() => {
    if (!flash) return
    document.getElementById(`app-${flash.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(t)
  }, [flash])

  // ----- actions -----

  const onStatus = (app: Application, status: Status) =>
    mutate(
      () => api.setStatus(app.id, status),
      () => showToast(`${app.company} → ${status}`),
    )

  const onMemo = async (app: Application, text: string) => {
    await api.setMemo(app.id, text) // errors go back to the inline editor
    await reload()
  }

  const onDelete = (app: Application) =>
    mutate(
      () => api.remove(app.id),
      () =>
        showToast(`Deleted ${app.company}`, {
          ms: 6000,
          undo: () =>
            mutate(
              () => api.restore(app.id),
              () => {
                showToast(`Restored ${app.company}`)
                jumpTo(app.id)
              },
            ),
        }),
    )

  const onSaved = async (saved: Application, created: boolean) => {
    setForm(null)
    await reload()
    const extra = saved.action.needsAction ? ' — added to Needs action' : ''
    showToast(created ? `Saved · ${saved.action.badge}${extra}` : `Updated ${saved.company} · ${saved.action.badge}`)
    jumpTo(saved.id)
  }

  const menuAction = (fn: () => void) => () => {
    setMenuOpen(false)
    fn()
  }

  const exportIcs = () => api.downloadCalendar().catch((e) => showToast(errorText(e), { tone: 'error' }))
  const resetDemo = () => mutate(api.resetDemo, () => showToast('Demo data reloaded'))
  const wipeAll = () => {
    if (window.confirm('Delete every application in this browser? This cannot be undone.')) {
      void mutate(api.wipeAll, () => showToast('All data wiped'))
    }
  }

  const openNew = () => setForm({ editing: null })

  // ----- render -----

  const railItem = (icon: IconName, label: string, onClick: () => void, active = false) => (
    <button type="button" className={`rail-btn${active ? ' active' : ''}`} onClick={onClick} aria-label={label}>
      <Icon name={icon} size={19} />
      <span className="rail-tip">{label}</span>
    </button>
  )

  return (
    <div className="shell">
      <aside className="rail" aria-label="Sections">
        <div className="rail-top">
          <span className="rail-logo" aria-hidden="true">
            <Icon name="logo" size={22} />
          </span>
          {railItem('search', 'Search', () => {
            scrollToId('applications')
            document.getElementById('search')?.focus({ preventScroll: true })
          })}
          <span className="rail-sep" />
          {railItem('layers', 'Applications', () => scrollToId('applications'), true)}
          {railItem('calendar', 'Upcoming deadlines', () => scrollToId('deadlines'))}
          {railItem('chart', 'Insights', () => scrollToId('insights'))}
        </div>
        <div className="rail-bottom">
          {railItem('download', 'Export deadlines (.ics)', () => void exportIcs())}
          {railItem(theme === 'dark' ? 'sun' : 'moon', theme === 'dark' ? 'Light mode' : 'Dark mode', toggleTheme)}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="brand">
            <span className="brand-logo" aria-hidden="true">
              <Icon name="logo" size={20} />
            </span>
            <span className="brand-text">
              <strong>NextUp</strong>
              <span>Internship tracker</span>
            </span>
            <span className="dot good" title="Connected" />
          </div>

          <nav className="topnav" aria-label="Jump to">
            <button type="button" className="active" onClick={() => scrollToId('overview')}>
              Overview
            </button>
            <button type="button" onClick={() => scrollToId('applications')}>
              Applications
            </button>
            <button type="button" onClick={() => scrollToId('deadlines')}>
              Deadlines
            </button>
            <button type="button" onClick={() => scrollToId('insights')}>
              Insights
            </button>
          </nav>

          <div className="top-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15} />
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
            <button type="button" className="btn primary new-btn" onClick={openNew}>
              <Icon name="plus" size={17} />
              <span>New application</span>
            </button>
            <div className="menu" ref={menuRef}>
              <button
                type="button"
                className="icon-btn round"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="More actions"
                onClick={() => setMenuOpen((o) => !o)}
              >
                <Icon name="more" size={18} />
              </button>
              {menuOpen && (
                <div className="menu-pop" role="menu">
                  <button type="button" role="menuitem" onClick={menuAction(() => void exportIcs())}>
                    <Icon name="calendar" size={16} /> Export deadlines (.ics)
                  </button>
                  <button type="button" role="menuitem" onClick={menuAction(() => void resetDemo())}>
                    <Icon name="reset" size={16} /> Reset demo data
                  </button>
                  <span className="menu-sep" />
                  <button type="button" role="menuitem" className="danger" onClick={menuAction(wipeAll)}>
                    <Icon name="wipe" size={16} /> Wipe all data
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {loadError && (
          <div className="banner" role="alert">
            <Icon name="alert" size={18} />
            <span>
              <strong>Can't reach the server.</strong> {loadError}
            </span>
            <button type="button" className="mini-btn" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        )}

        {!data ? (
          !loadError && <Skeleton />
        ) : (
          <>
            <Hero data={data} />
            <SummaryTiles data={data} filter={filter} onFilter={setFilter} />

            <div className="columns">
              <section className="list-col" aria-label="Applications">
                <FilterBar data={data} filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />

                {data.summary.total === 0 ? (
                  <div className="card empty">
                    <h3>No applications yet</h3>
                    <p className="muted">Add one to see what needs action next, or load the demo data to explore.</p>
                    <div className="empty-actions">
                      <button type="button" className="btn ghost" onClick={() => void resetDemo()}>
                        <Icon name="reset" size={16} /> Load demo data
                      </button>
                      <button type="button" className="btn primary" onClick={openNew}>
                        <Icon name="plus" size={16} /> Add your first application
                      </button>
                    </div>
                  </div>
                ) : visible.length === 0 ? (
                  <div className="card empty">
                    {filter === 'action' && !query ? (
                      <>
                        <h3>You're all caught up ✓</h3>
                        <p className="muted">Nothing is overdue, due within 3 days, or waiting on a follow-up.</p>
                      </>
                    ) : (
                      <>
                        <h3>No matches</h3>
                        <p className="muted">Try another filter or search.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="cards">
                    {visible.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        today={data.today}
                        flash={flash?.id === app.id}
                        onStatus={onStatus}
                        onMemo={onMemo}
                        onEdit={(a) => setForm({ editing: a })}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}
              </section>

              <aside className="side-col">
                <Deadlines data={data} onJump={jumpTo} onExport={() => void exportIcs()} />
                <Insights data={data} />
              </aside>
            </div>
          </>
        )}
      </main>

      <button type="button" className="fab" onClick={openNew} aria-label="New application">
        <Icon name="plus" size={24} />
      </button>

      {form && (
        <AppForm
          key={form.editing?.id ?? 'new'}
          editing={form.editing}
          resumeVersions={resumeVersions}
          onClose={() => setForm(null)}
          onSaved={(saved, created) => void onSaved(saved, created)}
        />
      )}

      <div className="toast-zone" aria-live="polite">
        {toast && (
          <div key={toast.key} className={`toast ${toast.tone}`}>
            <span className="toast-dot" />
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                className="toast-undo"
                onClick={() => {
                  const undo = toast.undo
                  setToast(null)
                  undo?.()
                }}
              >
                Undo
              </button>
            )}
            <button type="button" className="toast-x" onClick={() => setToast(null)} aria-label="Dismiss">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <div className="sk sk-hero" />
      <div className="sk-row">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk sk-tile" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="sk sk-card" />
      ))}
    </div>
  )
}
