import { dayDate, plural, shortDate } from '../format'
import { Icon } from '../icons'
import type { IconName } from '../icons'
import type { Dashboard } from '../types'

type Deadline = Dashboard['deadlines'][number]

const GROUPS: { label: string; test: (d: Deadline) => boolean }[] = [
  { label: 'Overdue', test: (d) => d.daysLeft < 0 },
  { label: 'Today', test: (d) => d.daysLeft === 0 },
  { label: 'Tomorrow', test: (d) => d.daysLeft === 1 },
  { label: 'This week', test: (d) => d.daysLeft >= 2 && d.daysLeft <= 7 },
  { label: 'Later', test: (d) => d.daysLeft > 7 },
]

export function Deadlines({
  data,
  onJump,
  onExport,
}: {
  data: Dashboard
  onJump: (id: string) => void
  onExport: () => void
}) {
  const statusOf = new Map(data.items.map((i) => [i.id, i.status]))
  return (
    <section className="card side-card" id="deadlines" aria-labelledby="deadlines-title">
      <header className="side-head">
        <h2 id="deadlines-title">
          <Icon name="calendar" size={18} className="accent" /> Upcoming deadlines
        </h2>
        <span className="mono-chip small">{data.deadlines.length} pending</span>
      </header>

      {data.deadlines.length === 0 && <p className="muted small empty-side">Nothing due in the next 14 days.</p>}

      {GROUPS.map((g) => {
        const rows = data.deadlines.filter(g.test)
        if (!rows.length) return null
        const later = g.label === 'Later'
        return (
          <div key={g.label} className="dl-group" data-group={g.label}>
            <h3>
              {g.label === 'Overdue' && <span className="dot bad" />}
              {g.label} ({rows.length})
            </h3>
            {rows.map((d) =>
              later ? (
                <button key={d.id} type="button" className="dl-row compact" onClick={() => onJump(d.id)}>
                  <span className="dl-name">
                    {d.company} — {d.role}
                  </span>
                  <span className="mono muted">{shortDate(d.deadline)}</span>
                </button>
              ) : (
                <button key={d.id} type="button" className="dl-row" data-sev={d.severity} onClick={() => onJump(d.id)}>
                  <span className="dl-text">
                    <span className="dl-name">
                      {d.company} — {d.role}
                    </span>
                    <span className="dl-sub">
                      {dayDate(d.deadline)} · {statusOf.get(d.id) ?? ''}
                    </span>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              ),
            )}
          </div>
        )
      })}

      <footer className="side-foot">
        <span className="muted small">
          <Icon name="calendar" size={14} /> Works with Google, Apple and Outlook
        </span>
        <button type="button" className="mini-btn" onClick={onExport}>
          Export .ics
        </button>
      </footer>
    </section>
  )
}

const TONE_ICON: Record<'warn' | 'good' | 'info', IconName> = { warn: 'warn', good: 'trend', info: 'info' }

export function Insights({ data }: { data: Dashboard }) {
  const { funnel, messages } = data.insights
  return (
    <section className="card side-card" id="insights" aria-labelledby="insights-title">
      <header className="side-head">
        <h2 id="insights-title">
          <Icon name="chart" size={18} className="accent" /> Insights
        </h2>
        <span className="mono-chip small">{plural(data.summary.total, 'app')}</span>
      </header>

      <div className="funnel-bars">
        {funnel.map((f) => (
          <div key={f.stage} className="fbar" data-status={f.stage}>
            <span className="fbar-label">{f.stage}</span>
            <span className="fbar-track">
              <span style={{ width: `${Math.max(f.pct, 2)}%` }} />
            </span>
            <span className="fbar-val mono">
              {f.count} · {f.pct}%
            </span>
          </div>
        ))}
      </div>

      {messages.slice(0, 3).map((m, i) => (
        <div key={i} className="callout" data-tone={m.tone}>
          <Icon name={TONE_ICON[m.tone]} size={16} />
          <div>
            <p>{m.text}</p>
            {m.tip && <p className="tip">{m.tip}</p>}
          </div>
        </div>
      ))}

      <p className="footnote">Insights only appear once there are 3 or more applications in a group.</p>
    </section>
  )
}
