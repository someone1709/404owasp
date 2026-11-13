import { Icon } from '../icons'
import type { Application } from '../types'
import { Roll } from './Roll'

/** The single most urgent thing, shown large: what to do, and how long you have. */
export function NextUp({ app, onOpen }: { app: Application; onOpen: (id: string) => void }) {
  const days = app.action.daysLeft
  const late = days < 0
  return (
    <section className="nextup" data-sev={app.action.severity} aria-label="Do this next">
      <div className="nextup-main">
        <span className="nextup-kicker">
          <Icon name="bolt" size={14} /> Do this next
        </span>
        <h2>{app.company}</h2>
        <p className="nextup-role">{app.role}</p>
        <p className="nextup-step">{app.nextActionMemo ?? app.action.nextStep}</p>
        <button type="button" className="btn neon" data-magnetic data-cursor="Open" onClick={() => onOpen(app.id)}>
          <Roll>Open card</Roll>
          <Icon name="arrow" size={16} />
        </button>
      </div>
      <div className="nextup-count" aria-label={app.action.badge}>
        <strong className="mono">{Math.abs(days)}</strong>
        <span>{late ? (Math.abs(days) === 1 ? 'day overdue' : 'days overdue') : days === 1 ? 'day left' : 'days left'}</span>
      </div>
    </section>
  )
}
