import { useState } from 'react'
import { shortDate } from '../format'
import { Icon } from '../icons'
import { STATUSES } from '../types'

import { SeverityBadge } from './Card'

/** Pipeline as columns. Drag a card to a column to change its status (or use the arrows). */
export function Board({ items, flashId, onStatus, onEdit }) {
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)

  const move = (app, step) => {
    const next = STATUSES[STATUSES.indexOf(app.status) + step]
    if (next) onStatus(app, next)
  }

  return (
    <div className="board" aria-label="Pipeline board">
      {STATUSES.map((status) => {
        const apps = items.filter((i) => i.status === status)
        return (
          <section
            key={status}
            className="col"
            data-status={status}
            data-over={over === status && dragging !== null}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(status)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOver(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const app = items.find((i) => i.id === (e.dataTransfer.getData('text/plain') || dragging))
              setOver(null)
              setDragging(null)
              if (app && app.status !== status) onStatus(app, status)
            }}
          >
            <header className="col-head">
              <span className="col-dot" />
              <h3>{status}</h3>
              <span className="col-count mono">{apps.length}</span>
            </header>

            <div className="col-body">
              {apps.map((app) => (
                <article
                  key={app.id}
                  id={`app-${app.id}`}
                  className={`bcard${dragging === app.id ? ' dragging' : ''}${flashId === app.id ? ' flash' : ''}`}
                  data-sev={app.action.severity}
                  data-cursor="Drag"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', app.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragging(app.id)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                >
                  <h4>{app.company}</h4>
                  <p className="bcard-role">{app.role}</p>
                  <SeverityBadge app={app} />
                  <p className="bcard-step">{app.nextActionMemo ?? app.action.nextStep}</p>
                  <footer>
                    <span className="mono muted small">Due {shortDate(app.deadline)}</span>
                    <span className="bcard-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${app.company} back a stage`}
                        disabled={STATUSES.indexOf(app.status) === 0}
                        onClick={() => move(app, -1)}
                      >
                        <Icon name="left" size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${app.company} forward a stage`}
                        disabled={STATUSES.indexOf(app.status) === STATUSES.length - 1}
                        onClick={() => move(app, 1)}
                      >
                        <Icon name="right" size={15} />
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Edit ${app.company}`} onClick={() => onEdit(app)}>
                        <Icon name="edit" size={15} />
                      </button>
                    </span>
                  </footer>
                </article>
              ))}
              {apps.length === 0 && <p className="col-empty">Drop a card here</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
