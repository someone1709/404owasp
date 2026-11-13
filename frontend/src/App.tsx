// Placeholder that proves the frontend <-> backend wiring works.
// Replace it with the real UI described in FRONTEND_SPEC.md.

import { useEffect, useState } from 'react'
import { api } from './api'
import type { Dashboard } from './types'

export default function App() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.dashboard().then(setData, (e: Error) => setError(e.message))
  }, [])

  if (error) return <p>Can't reach the server: {error}</p>
  if (!data) return <p>Loading…</p>

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>NextUp is connected ✓</h1>
      <p>
        {data.summary.needsAction} of {data.summary.total} applications need action ·{' '}
        {Object.entries(data.summary.counts).map(([s, n]) => `${s} ${n}`).join(' · ')}
      </p>
      <ul>
        {data.items.map((a) => (
          <li key={a.id}>
            <strong>{a.company}</strong> ({a.status}) [{a.action.badge}] → {a.nextActionMemo ?? a.action.nextStep}
          </li>
        ))}
      </ul>
    </main>
  )
}
