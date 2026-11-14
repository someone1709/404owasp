import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import { addedAgo, isHttpLink, NEXT_STAGE, shortDate, STAGE, stampDate } from '../format'
import { Icon } from '../icons'

import { STATUSES } from '../types'

const BADGE_ICON = {
  overdue: 'alert',
  soon: 'warn',
  stale: 'clock',
  ok: 'calendar',
  closed: 'check',
}

const MEMO_MAX = 140

export function SeverityBadge({ app }) {
  return (
    <span className="badge" data-sev={app.action.severity}>
      <Icon name={BADGE_ICON[app.action.severity]} size={14} />
      {app.action.badge}
    </span>
  )
}

/** Pipeline progress ring: Applied 1/4 … Offer 4/4. Rejected shows as closed. */
function StageRing({ status }) {
  const stage = STAGE[status]
  const closed = status === 'Rejected'
  return (
    <div className="ring" data-status={status} aria-label={closed ? 'Closed' : `Stage ${stage} of 4`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="ring-track" cx="32" cy="32" r="27" pathLength={100} />
        {!closed && (
          <circle className="ring-value" cx="32" cy="32" r="27" pathLength={100} strokeDasharray={`${stage * 25} 100`} />
        )}
      </svg>
      <div className="ring-label">
        <strong>{closed ? '✕' : `${stage}/4`}</strong>
        <span>{closed ? 'Closed' : 'Stage'}</span>
      </div>
    </div>
  )
}

function History({ app }) {
  const steps = app.history.slice(-3)
  const next = NEXT_STAGE[app.status]
  return (
    <ul className="history">
      {steps.map((h, i) => (
        <li key={`${h.status}-${i}`} data-done={h.status === 'Rejected' ? 'no' : 'yes'}>
          <Icon name={h.status === 'Rejected' ? 'x' : 'check'} size={14} />
          {h.status} <span className="muted">· {stampDate(h.at)}</span>
        </li>
      ))}
      {next && (
        <li data-done="pending">
          <span className="history-dot" />
          Next: {next}
        </li>
      )}
    </ul>
  )
}

function MemoEditor({ app, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const settled = useRef(false) // set once Enter, Esc or blur has decided this edit
  const input = useRef(null)
  const memo = app.nextActionMemo ?? ''

  useEffect(() => {
    if (editing) input.current?.select() // focus with the old text selected, so typing replaces it
  }, [editing])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(t)
  }, [saved])

  function start() {
    settled.current = false
    setDraft(memo)
    setError('')
    setEditing(true)
  }

  async function save(text) {
    setSaving(true)
    setError('')
    try {
      await onSave(text)
      setEditing(false)
      setSaved(true)
    } catch (e) {
      settled.current = false
      setEditing(true)
      setError(e instanceof ApiError ? (e.errors?.nextActionMemo ?? e.message) : 'Could not save the memo')
    } finally {
      setSaving(false)
    }
  }

  function commit() {
    if (settled.current) return
    settled.current = true
    const text = draft.trim()
    if (text === memo) {
      setEditing(false)
      return
    }
    void save(text)
  }

  function cancel() {
    settled.current = true
    setEditing(false)
    setError('')
  }

  return (
    <div className="nextstep" data-sev={app.action.severity}>
      <Icon name="forward" size={16} className="nextstep-icon" />
      <div className="nextstep-body">
        {editing ? (
          <div className="memo-edit">
            <label className="sr-only" htmlFor={`memo-${app.id}`}>
              Next action for {app.company}
            </label>
            <input
              id={`memo-${app.id}`}
              ref={input}
              value={draft}
              maxLength={MEMO_MAX}
              disabled={saving}
              placeholder="e.g. Email HR for a new test link"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  cancel()
                }
              }}
              aria-invalid={!!error}
            />
            <span className="memo-count">
              {draft.length}/{MEMO_MAX} · Enter to save · Esc to cancel
            </span>
          </div>
        ) : memo ? (
          <button type="button" className="memo-text" onClick={start} title="Edit next step">
            <strong>Next step:</strong> {memo}
            <Icon name="edit" size={13} className="memo-pencil" />
          </button>
        ) : (
          <div className="memo-suggest">
            <button type="button" className="memo-text suggested" onClick={start} title="Write your own next step">
              Suggested: {app.action.nextStep}
              <Icon name="edit" size={13} className="memo-pencil" />
            </button>
            <button type="button" className="mini-btn" disabled={saving} onClick={() => void save(app.action.nextStep)}>
              Use
            </button>
          </div>
        )}
        {error && <p className="field-error">{error}</p>}
        {app.action.reason && <p className="reason">{app.action.reason}</p>}
      </div>
      {saved && (
        <span className="saved-tick" role="status">
          <Icon name="check" size={13} /> Saved
        </span>
      )}
    </div>
  )
}

export function AppCard({ app, today, flash, onStatus, onMemo, onEdit, onDelete }) {
  return (
    <article
      id={`app-${app.id}`}
      className={`card app-card${flash ? ' flash' : ''}`}
      data-sev={app.action.severity}
      data-status={app.status}
    >
      <header className="app-head">
        <div className="app-title">
          <h3>
            {app.company}
            <span className="app-ago"> · {addedAgo(app.createdAt, today)}</span>
          </h3>
          <p className="app-role">{app.role}</p>
        </div>
        <SeverityBadge app={app} />
      </header>

      <MemoEditor app={app} onSave={(text) => onMemo(app, text)} />

      <div className="app-mid">
        <StageRing status={app.status} />
        <History app={app} />
        <div className="chips">
          <span className="chip">{app.source}</span>
          <span className="chip mono">{app.resumeVersion}</span>
          <span className="chip">{app.companyType}</span>
          <span className="chip mono">Due {shortDate(app.deadline)}</span>
          {app.status === 'Offer' && <span className="chip good">Offer in hand</span>}
        </div>
      </div>

      {app.notes && <p className="app-notes">{app.notes}</p>}

      <footer className="app-foot">
        <label className="status-pick" data-status={app.status}>
          <span className="muted">Current status:</span>
          <span className="select-pill">
            <select value={app.status} onChange={(e) => onStatus(app, e.target.value)} aria-label={`Status for ${app.company}`}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={14} />
          </span>
        </label>
        <div className="app-actions">
          <button type="button" className="icon-btn" onClick={() => onEdit(app)} title="Edit" aria-label={`Edit ${app.company}`}>
            <Icon name="edit" size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onDelete(app)}
            title="Delete"
            aria-label={`Delete ${app.company}`}
          >
            <Icon name="trash" size={16} />
          </button>
          {isHttpLink(app.link) && (
            <a
              className="icon-btn"
              href={app.link}
              target="_blank"
              rel="noopener noreferrer"
              title="Open job posting"
              aria-label={`Open job posting for ${app.company}`}
            >
              <Icon name="external" size={16} />
            </a>
          )}
        </div>
      </footer>
    </article>
  )
}
