import { addDays, dayOfMonth, parseDate, weekdayShort } from '../format'

/** The next two weeks as a strip. Every dot is a deadline; select one to open its card. */
export function Timeline({ data, onJump }) {
  const days = Array.from({ length: 15 }, (_, i) => ({ iso: addDays(data.today, i), n: i }))
  const overdue = data.deadlines.filter((d) => d.daysLeft < 0)

  const dots = (list) =>
    list.length > 0 && (
      <span className="tl-dots">
        {list.slice(0, 4).map((d) => (
          <button
            key={d.id}
            type="button"
            className="tl-dot"
            data-sev={d.severity}
            title={`${d.company} — ${d.role}`}
            aria-label={`${d.company}, ${d.role}`}
            data-cursor="Open"
            onClick={() => onJump(d.id)}
          />
        ))}
        {list.length > 4 && <span className="tl-more mono">+{list.length - 4}</span>}
      </span>
    )

  return (
    <section className="card timeline" aria-label="Next 14 days">
      <div className="tl-scroll">
        <div className="tl-grid">
          <div className="tl-cell tl-overdue" data-empty={overdue.length === 0}>
            <span className="tl-day">Late</span>
            <span className="tl-num">{overdue.length || '–'}</span>
            {dots(overdue)}
          </div>
          {days.map((d) => {
            const list = data.deadlines.filter((x) => x.daysLeft === d.n)
            return (
              <div
                key={d.iso}
                className="tl-cell"
                data-today={d.n === 0}
                data-empty={list.length === 0}
                data-weekend={[0, 6].includes(parseDate(d.iso).getDay())}
              >
                <span className="tl-day">{d.n === 0 ? 'Today' : weekdayShort(d.iso)}</span>
                <span className="tl-num mono">{dayOfMonth(d.iso)}</span>
                {dots(list)}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
