// A tiny History-API router: real URLs (/applications, /deadlines, /insights),
// working back/forward buttons, no extra dependency. The Express server already
// answers every non-API GET with index.html, so deep links and refreshes work.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/'

export const RouterContext = createContext({ path: '/', navigate: () => {} })
export const useRoute = () => useContext(RouterContext)

/** Owns the current path. Call once, at the top of the app, and provide the result. */
export function useRouter() {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to) => {
    if (to !== currentPath()) window.history.pushState({}, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }, [])

  return useMemo(() => ({ path, navigate }), [path, navigate])
}

/** A real <a href>, so open-in-new-tab and copy-link work; plain clicks stay in the app. */
export function Link({ to, children, onClick, ...rest }) {
  const { path, navigate } = useRoute()
  const handle = (e) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} aria-current={path === to ? 'page' : undefined} onClick={handle} {...rest}>
      {children}
    </a>
  )
}
