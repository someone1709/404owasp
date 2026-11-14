import { longDate, pad2, plural, STATUS_HINT } from '../format'
import { Icon } from '../icons'
import { Split } from './Split'
import { STATUSES } from '../types'

// ---------- Hero ----------

const ARC_RADII = [176, 138, 100, 62] // Applied (outer) → Offer (inner)

function FunnelArcs({ funnel }) {
  return (
    <div className="arcs">
      <div className="arcs-glow" />
      <div className="arcs-plot">
        <svg viewBox="0 0 400 206" aria-hidden="true">
          {funnel.map((f, i) => {
            const r = ARC_RADII[i]
            const d = `M ${200 - r} 200 A ${r} ${r} 0 0 1 ${200 + r} 200`
            return (
              <g key={f.stage} className={`arc arc-${i}`}>
                <path className="arc-track" d={d} pathLength={100} />
                <path className="arc-value" d={d} pathLength={100} strokeDasharray={`${Math.max(f.pct, 0.5)} 100`} />
              </g>
            )
          })}
        </svg>
        {funnel.map((f, i) => (
          <span key={f.stage} className={`arc-chip arc-chip-${i}`} style={{ top: `${((200 - ARC_RADII[i]) / 206) * 100}%` }}>
            {f.count} {f.stage}
          </span>
        ))}
      </div>
      <div className="arcs-axis">
        <span>Applied</span>
        <span className="arcs-title">How far your applications get</span>
        <span>Offer</span>
      </div>
    </div>
  )
}

export function FunnelCard({ funnel }) {
  return (
    <div className="card hero-chart" id="insights-funnel">
      <FunnelArcs funnel={funnel} />
      <div className="legend">
        <div className="legend-head">
          <Icon name="trend" size={14} /> Pipeline funnel
        </div>
        {funnel.map((f) => (
          <div key={f.stage} className={`legend-row${f.stage === 'Offer' ? ' hot' : ''}`}>
            <span>{f.stage}</span>
            <span className="mono">
              {f.count} · {f.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Hero({ data }) {
  const n = data.summary.needsAction
  const thisWeek = data.deadlines.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 7).length
  return (
    <section className="hero" id="overview">
      <div className="hero-copy">
        <div className="hero-meta">
          <span className="date-chip">Today, {longDate(data.today)}</span>
          <span className={`live${n ? '' : ' calm'}`}>
            <span className="live-dot" />
            {n ? `${plural(n, 'application')} need${n === 1 ? 's' : ''} your attention` : "You're all caught up"}
          </span>
        </div>
        <div className="hero-title">
          <h1>
            <Split lines={['Your', 'next move']} />
          </h1>
          <span className="mono-chip">NextUp</span>
        </div>
        <p className="hero-lede">
          Every deadline, follow-up and next step for your internship hunt, worked out fresh for today. Amber means due within 3
          days, red means overdue.
        </p>
        <div className="hero-foot">
          <span className="privacy-chip">
            <Icon name="lock" size={14} /> Demo data · no accounts · no tracking
          </span>
          <span className="muted small">{plural(thisWeek, 'deadline')} in the next 7 days</span>
        </div>
      </div>

      <FunnelCard funnel={data.insights.funnel} />
    </section>
  )
}

// ---------- Pipeline summary ----------

export function SummaryTiles({ data, filter, onFilter }) {
  const { counts, total } = data.summary
  return (
    <section className="summary" aria-label="Pipeline summary">
      <div className="tiles">
        {STATUSES.map((s) => {
          const urgent = data.items.filter((i) => i.status === s && i.action.needsAction).length
          const selected = filter === s
          return (
            <button
              key={s}
              type="button"
              className={`tile${selected ? ' selected' : ''}`}
              data-status={s}
              aria-pressed={selected}
              onClick={() => onFilter(selected ? 'all' : s)}
            >
              <span className="tile-head">
                <span className="tile-name">{s}</span>
                {urgent > 0 ? <span className="tile-flag">Action</span> : <span className="tile-dot" />}
              </span>
              <span key={counts[s]} className="tile-count pop" aria-live="polite">
                {pad2(counts[s])}
              </span>
              <span className="tile-hint">{urgent > 0 ? `${urgent} need${urgent === 1 ? 's' : ''} action` : STATUS_HINT[s]}</span>
            </button>
          )
        })}
      </div>
      <div className="stackbar" role="img" aria-label={STATUSES.map((s) => `${s} ${counts[s]}`).join(', ')}>
        {STATUSES.map((s) =>
          counts[s] ? (
            <span
              key={s}
              data-status={s}
              style={{ width: `${(counts[s] / Math.max(total, 1)) * 100}%` }}
              title={`${s}: ${counts[s]}`}
            />
          ) : null,
        )}
      </div>
    </section>
  )
}

// ---------- Filter bar ----------

export function FilterBar({ data, filter, onFilter, query, onQuery }) {
  const pill = (f, label, extra = '') => (
    <button
      key={f}
      type="button"
      className={`pill${filter === f ? ' active' : ''}${extra}`}
      aria-pressed={filter === f}
      onClick={() => onFilter(f)}
    >
      {label}
    </button>
  )
  return (
    <div className="filterbar" id="applications">
      <div className="pills" role="toolbar" aria-label="Filter applications">
        {pill('all', `All (${data.summary.total})`)}
        <button
          type="button"
          className={`pill needs${filter === 'action' ? ' active' : ''}`}
          aria-pressed={filter === 'action'}
          onClick={() => onFilter('action')}
        >
          <span className="needs-dot" />
          Needs action ({data.summary.needsAction})
        </button>
        {STATUSES.map((s) => pill(s, `${s} (${data.summary.counts[s]})`))}
      </div>
      <label className="search">
        <Icon name="search" size={16} />
        <span className="sr-only">Search by company or role</span>
        <input
          id="search"
          type="search"
          value={query}
          maxLength={60}
          placeholder="Search by company or role…"
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
    </div>
  )
}
