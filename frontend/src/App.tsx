import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { Icon } from './icons'
import type { IconName } from './icons'
import { ApplicationsPage } from './pages/Applications'
import { DeadlinesPage } from './pages/Deadlines'
import { HomePage } from './pages/Home'
import { InsightsPage } from './pages/Insights'
import type { CardActions, PageProps } from './pages/types'
import { Link, RouterContext, useRouter } from './router'
import type { Application, Dashboard, Status } from './types'
import { AppForm } from './ui/Form'
import type { Filter } from './ui/Overview'

type Theme = 'light' | 'dark'
interface Toast {
  key: number
  text: string
  tone: 'info' | 'error'
  undo?: () => void
  ms: number
}

const THEME_KEY = 'nextup:theme'

const PAGES: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Overview', icon: 'home' },
  { path: '/applications', label: 'Applications', icon: 'layers' },
  { path: '/deadlines', label: 'Deadlines', icon: 'calendar' },
  { path: '/insights', label: 'Insights', icon: 'chart' },
]

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

export default function App() {
  const route = useRouter()
  const { path, navigate } = route

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

  // ----- page title & menu closing on navigation -----

  const page = PAGES.find((p) => p.path === path)
  useEffect(() => {
    document.title = `${page ? page.label : 'Not found'} · NextUp`
    setMenuOpen(false)
  }, [page, path])

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

  /** Open a card: go to Applications, clear any filter hiding it, scroll to it and flash it. */
  const jumpTo = useCallback(
    (id: string) => {
      if (!visible.some((i) => i.id === id)) {
        setFilter('all')
        setQuery('')
      }
      navigate('/applications')
      setFlash({ id, n: Date.now() })
    },
    [visible, navigate],
  )

  useEffect(() => {
    if (!flash) return
    document.getElementById(`app-${flash.id}`)?.scrollIntoView({ block: 'center' }) // instant: reliable right after a page change
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

  const exportIcs = () => void api.downloadCalendar().catch((e) => showToast(errorText(e), { tone: 'error' }))
  const resetDemo = () => void mutate(api.resetDemo, () => showToast('Demo data reloaded'))
  const wipeAll = () => {
    if (window.confirm('Delete every application in this browser? This cannot be undone.')) {
      void mutate(api.wipeAll, () => showToast('All data wiped'))
    }
  }

  const openNew = () => setForm({ editing: null })

  const focusSearch = () => {
    navigate('/applications')
    setTimeout(() => document.getElementById('search')?.focus(), 60)
  }

  const actions: CardActions = { onStatus, onMemo, onEdit: (a) => setForm({ editing: a }), onDelete }

  // ----- render -----

  const needs = data?.summary.needsAction ?? 0
  const count = (p: string) => (p === '/applications' && needs > 0 ? <span className="nav-count">{needs}</span> : null)

  const pageProps: PageProps | null = data
    ? {
        data,
        visible,
        filter,
        setFilter,
        query,
        setQuery,
        flashId: flash?.id ?? null,
        actions,
        openNew,
        jumpTo,
        exportIcs,
        resetDemo,
      }
    : null

  function renderPage() {
    if (!page) return <NotFound />
    if (!pageProps) return loadError ? null : <Skeleton />
    switch (page.path) {
      case '/applications':
        return <ApplicationsPage {...pageProps} />
      case '/deadlines':
        return <DeadlinesPage {...pageProps} />
      case '/insights':
        return <InsightsPage {...pageProps} />
      default:
        return <HomePage {...pageProps} />
    }
  }

  return (
    <RouterContext.Provider value={route}>
      <div className="shell">
        <aside className="rail" aria-label="Tools">
          <div className="rail-top">
            <Link to="/" className="rail-logo" aria-label="NextUp overview">
              <Icon name="logo" size={22} />
            </Link>
            <button type="button" className="rail-btn" onClick={focusSearch} aria-label="Search applications">
              <Icon name="search" size={19} />
              <span className="rail-tip">Search</span>
            </button>
            <button type="button" className="rail-btn" onClick={openNew} aria-label="New application">
              <Icon name="plus" size={19} />
              <span className="rail-tip">New application</span>
            </button>
          </div>
          <div className="rail-bottom">
            <button type="button" className="rail-btn" onClick={exportIcs} aria-label="Export deadlines (.ics)">
              <Icon name="download" size={19} />
              <span className="rail-tip">Export deadlines (.ics)</span>
            </button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <Link to="/" className="brand" aria-label="NextUp overview">
              <span className="brand-logo" aria-hidden="true">
                <Icon name="logo" size={20} />
              </span>
              <span className="brand-text">
                <strong>NextUp</strong>
                <span>Internship tracker</span>
              </span>
              <span className="dot good" title="Connected" />
            </Link>

            <nav className="topnav" aria-label="Pages">
              {PAGES.map((p) => (
                <Link key={p.path} to={p.path}>
                  {p.label}
                  {count(p.path)}
                </Link>
              ))}
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
                    <button type="button" role="menuitem" onClick={menuAction(exportIcs)}>
                      <Icon name="calendar" size={16} /> Export deadlines (.ics)
                    </button>
                    <button type="button" role="menuitem" onClick={menuAction(resetDemo)}>
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

          {renderPage()}
        </main>

        <nav className="bottomnav" aria-label="Pages">
          {PAGES.map((p) => (
            <Link key={p.path} to={p.path}>
              <Icon name={p.icon} size={20} />
              {p.label}
              {count(p.path)}
            </Link>
          ))}
        </nav>

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
    </RouterContext.Provider>
  )
}

function NotFound() {
  return (
    <div className="card empty">
      <h3>Page not found</h3>
      <p className="muted">That address doesn't match any page in NextUp.</p>
      <div className="empty-actions">
        <Link to="/" className="btn primary">
          Back to overview
        </Link>
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
