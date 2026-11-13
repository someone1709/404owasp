import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { Icon } from './icons'
import type { IconName } from './icons'
import { confetti, usePointerFx, useScrollFx } from './fx'
import { ApplicationsPage } from './pages/Applications'
import { DeadlinesPage } from './pages/Deadlines'
import { HomePage } from './pages/Home'
import { InsightsPage } from './pages/Insights'
import { ResumePage } from './pages/Resume'
import type { CardActions, PageProps } from './pages/types'
import { Link, RouterContext, useRouter } from './router'
import type { Application, Dashboard, Status } from './types'
import { Cursor } from './ui/Cursor'
import { AppForm } from './ui/Form'
import { MenuOverlay } from './ui/MenuOverlay'
import type { Filter } from './ui/Overview'
import { Palette } from './ui/Palette'
import type { PaletteItem } from './ui/Palette'
import { Roll } from './ui/Roll'
import { ScrollRail } from './ui/ScrollRail'
import { TopNav } from './ui/TopNav'

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
  { path: '/resume', label: 'Resume Lab', icon: 'file' },
]

const VIEW_KEY = 'nextup:view'

function initialView(): 'list' | 'board' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

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
  const [view, setViewState] = useState<'list' | 'board'>(initialView)
  const [palette, setPalette] = useState(false)
  const [bigMenu, setBigMenu] = useState(false)

  usePointerFx()
  useScrollFx()

  const setView = (v: 'list' | 'board') => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* not critical */
    }
  }

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

  const notify = useCallback((text: string, tone: 'info' | 'error' = 'info') => showToast(text, { tone }), [showToast])

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
      () => {
        showToast(status === 'Offer' ? `Offer from ${app.company}! 🎉` : `${app.company} → ${status}`)
        if (status === 'Offer') confetti()
      },
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

  const onSaved = async (saved: Application, created: boolean, note?: string) => {
    setForm(null)
    await reload()
    const extra = saved.action.needsAction ? ' — added to Needs action' : ''
    const tail = note ? ` · ${note}` : ''
    showToast(
      (created ? `Saved · ${saved.action.badge}${extra}` : `Updated ${saved.company} · ${saved.action.badge}`) + tail,
      { ms: note ? 5500 : 3500 },
    )
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

  // ----- keyboard -----

  const dialogOpen = !!form || palette || bigMenu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBigMenu(false)
        setPalette((p) => !p)
        return
      }
      if (typing || dialogOpen || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n') {
        e.preventDefault()
        openNew()
      } else if (e.key === '/') {
        e.preventDefault()
        setPalette(true)
      } else if (e.key === 'm') {
        setBigMenu(true)
      } else if (/^[1-9]$/.test(e.key) && PAGES[Number(e.key) - 1]) {
        navigate(PAGES[Number(e.key) - 1].path)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = PAGES.map((p, i) => ({
      id: `go-${p.path}`,
      group: 'Go to',
      label: p.label,
      hint: String(i + 1),
      icon: p.icon,
      run: () => navigate(p.path),
    }))
    items.push(
      { id: 'a-new', group: 'Actions', label: 'New application', hint: 'N', icon: 'plus', run: openNew },
      { id: 'a-board', group: 'Actions', label: 'Open the pipeline board', icon: 'board', run: () => { setView('board'); navigate('/applications') } },
      { id: 'a-list', group: 'Actions', label: 'Open the application list', icon: 'list', run: () => { setView('list'); navigate('/applications') } },
      { id: 'a-needs', group: 'Actions', label: 'Show only what needs action', icon: 'bolt', run: () => { setFilter('action'); navigate('/applications') } },
      { id: 'a-ics', group: 'Actions', label: 'Export deadlines (.ics)', icon: 'download', run: exportIcs },
      { id: 'a-theme', group: 'Actions', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', icon: theme === 'dark' ? 'sun' : 'moon', run: toggleTheme },
      { id: 'a-reset', group: 'Actions', label: 'Reset demo data', icon: 'reset', run: resetDemo },
    )
    for (const a of data?.items ?? []) {
      items.push({ id: `app-${a.id}`, group: 'Applications', label: `${a.company} — ${a.role}`, hint: a.status, icon: 'layers', run: () => jumpTo(a.id) })
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme, jumpTo, navigate])

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
        notify,
        view,
        setView,
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
      case '/resume':
        return <ResumePage {...pageProps} />
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

            <TopNav items={PAGES.map((p) => ({ path: p.path, label: p.label, badge: p.path === '/applications' ? needs : 0 }))} />

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
              <button type="button" className="kbar" onClick={() => setPalette(true)} aria-label="Open command palette" data-cursor="Search">
                <Icon name="search" size={14} />
                <span>Search</span>
                <kbd className="kbd">⌘K</kbd>
              </button>
              <button type="button" className="btn primary new-btn" onClick={openNew} data-magnetic>
                <Icon name="plus" size={17} />
                <span>
                  <Roll>New application</Roll>
                </span>
              </button>
              <button type="button" className="btn neon menu-btn" onClick={() => setBigMenu(true)} aria-haspopup="dialog" data-magnetic>
                <span className="menu-btn-label">
                  <Roll>Menu</Roll>
                </span>
                <Icon name="menu" size={18} />
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

          <span key={`bar-${path}`} className="route-bar" aria-hidden="true" />
          <div key={path} className="page">
            {renderPage()}
          </div>
        </main>

        <nav className="bottomnav" aria-label="Pages">
          {PAGES.map((p) => (
            <Link key={p.path} to={p.path}>
              <Icon name={p.icon} size={20} />
              {p.label.split(' ')[0]}
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
            onSaved={(saved, created, note) => void onSaved(saved, created, note)}
          />
        )}

        <Palette open={palette} onClose={() => setPalette(false)} items={paletteItems} />
        <MenuOverlay
          open={bigMenu}
          onClose={() => setBigMenu(false)}
          pages={PAGES.map((p) => ({
            path: p.path,
            label: p.label,
            meta:
              p.path === '/applications'
                ? `${data?.summary.total ?? 0} tracked · ${needs} need action`
                : p.path === '/deadlines'
                  ? `${data?.deadlines.length ?? 0} in 14 days`
                  : p.path === '/resume'
                    ? 'your versions, ranked'
                    : p.path === '/insights'
                      ? 'what is working'
                      : 'today at a glance',
          }))}
          next={data?.deadlines[0]}
          onOpenNext={jumpTo}
          onNew={openNew}
          onPalette={() => setPalette(true)}
          onExport={exportIcs}
          onTheme={toggleTheme}
          dark={theme === 'dark'}
        />
        <Cursor />
        <ScrollRail />

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
