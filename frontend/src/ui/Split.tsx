// Headline whose letters rise into place one after another (a masked "split text" reveal).
// Screen readers get the plain text; the animated letters are hidden from them.

export function Split({ lines }: { lines: string[] }) {
  let n = 0
  return (
    <span className="split">
      <span className="sr-only">{lines.join(' ')}</span>
      {lines.map((line, li) => (
        <span key={li} className="split-line" aria-hidden="true">
          {Array.from(line).map((ch, i) => (
            <span key={i} className="split-ch" style={{ '--c': n++ } as React.CSSProperties}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}
