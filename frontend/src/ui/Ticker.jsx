const label = (d) => (d.daysLeft < 0 ? `overdue ${-d.daysLeft}d` : d.daysLeft === 0 ? 'due today' : `due in ${d.daysLeft}d`)

/** A slow marquee of live deadlines. Decorative: the same data is in the Deadlines panel. */
export function Ticker({ data }) {
  const base = data.deadlines.length
    ? data.deadlines.map((d) => ({ id: d.id, sev: d.severity, text: `${d.company} · ${label(d)}` }))
    : [{ id: 'clear', sev: 'ok', text: "You're all caught up · nothing due in 14 days" }]

  // Repeat the content so one half always overflows the screen, then loop it seamlessly.
  const half = Array.from({ length: Math.max(1, Math.ceil(14 / base.length)) }, () => base).flat()

  const run = (copy) => (
    <ul className="ticker-run" aria-hidden="true" key={copy}>
      {half.map((it, i) => (
        <li key={`${it.id}-${i}`} data-sev={it.sev}>
          <span className="ticker-star">✦</span>
          {it.text}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="ticker" data-vel aria-hidden="true">
      <div className="ticker-track">
        {run(0)}
        {run(1)}
      </div>
    </div>
  )
}
