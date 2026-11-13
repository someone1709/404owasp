// Letter-by-letter "roll" hover: each character slides up and its twin slides in.
// Put it inside any link or button; the effect runs when the parent is hovered or focused.

export function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span className="sr-only">{children}</span>
      <span className="roll-track" aria-hidden="true">
        {Array.from(children).map((ch, i) => (
          <span key={i} className="roll-ch" style={{ '--i': i } as React.CSSProperties}>
            <span>{ch === ' ' ? ' ' : ch}</span>
            <span>{ch === ' ' ? ' ' : ch}</span>
          </span>
        ))}
      </span>
    </span>
  )
}
