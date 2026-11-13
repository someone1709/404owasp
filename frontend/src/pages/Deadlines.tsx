import { Icon } from '../icons'
import { Deadlines } from '../ui/Side'
import { PageHead } from '../ui/PageHead'
import { Timeline } from '../ui/Timeline'
import type { PageProps } from './types'

export function DeadlinesPage({ data, jumpTo, exportIcs }: PageProps) {
  const overdue = data.deadlines.filter((d) => d.daysLeft < 0).length
  const soon = data.deadlines.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 3).length

  return (
    <div className="page-narrow">
      <PageHead
        title="Deadlines"
        sub="Everything overdue plus the next 14 days. Select one to jump to its card."
        actions={
          <button type="button" className="btn ghost" onClick={exportIcs}>
            <Icon name="download" size={16} /> Export .ics
          </button>
        }
      />
      <div className="stats">
        <div className="card stat" data-tone="bad">
          <span>Overdue</span>
          <strong>{overdue}</strong>
        </div>
        <div className="card stat" data-tone="warn">
          <span>Due within 3 days</span>
          <strong>{soon}</strong>
        </div>
        <div className="card stat">
          <span>Next 14 days</span>
          <strong>{data.deadlines.length}</strong>
        </div>
      </div>
      <Timeline data={data} onJump={jumpTo} />
      <Deadlines data={data} onJump={jumpTo} onExport={exportIcs} />
    </div>
  )
}
