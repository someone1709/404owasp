import { daysBetween } from '../format'
import { Icon } from '../icons'
import type { Application } from '../types'
import { Roll } from './Roll'

/** The single most urgent thing, shown large: what to do, and how long you have. */
export function NextUp({ app, today, onOpen }: { app: Application; today: string; onOpen: (id: string) => void }) {
  // A "no reply" follow-up isn't about a deadline: count how long it has been quiet instead.
  const stale = app.action.severity === 'stale'
  const days = stale ? daysBetween((app.history.at(-1)?.at ?? app.createdAt).slice(0, 10), today) : app.action.daysLeft
  const late = !stale && days < 0
  const unit = stale
    ? days === 1 ? 'day without a reply' : 'days without a reply'
    : late
      ? Math.abs(days) === 1 ? 'day overdue' : 'days overdue'
      : days === 1 ? 'day left' : 'days left'
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
        <span>{unit}</span>
      </div>
    </section>
  )
}
