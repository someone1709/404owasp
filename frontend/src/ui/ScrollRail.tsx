import { Icon } from '../icons'

/** A thin neon progress line on the right edge and a back-to-top ring that fills as you scroll. */
export function ScrollRail() {
  return (
    <div className="scroll-rail" data-progress aria-hidden="false">
      <span className="rail-line" aria-hidden="true">
        <span />
      </span>
      <button
        type="button"
        className="to-top"
        aria-label="Back to top"
        data-cursor="Top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <svg className="to-top-ring" viewBox="0 0 44 44" aria-hidden="true">
          <circle className="to-top-track" cx="22" cy="22" r="20" />
          <circle className="to-top-fill" cx="22" cy="22" r="20" pathLength={100} />
        </svg>
        <Icon name="up" size={16} />
      </button>
    </div>
  )
}
