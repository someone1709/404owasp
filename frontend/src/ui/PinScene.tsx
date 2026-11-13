import type { Dashboard, Status } from '../types'

/** Bottom of the stack to the top; Rejected sits underneath, fallen out of the funnel. */
const STACK: { status: Status; z: number; k: number }[] = [
  { status: 'Rejected', z: 0, k: 4 },
  { status: 'Applied', z: 1, k: 0 },
  { status: 'Test', z: 2, k: 1 },
  { status: 'Interview', z: 3, k: 2 },
  { status: 'Offer', z: 4, k: 3 },
]

const STORY: { status: Status; line: string }[] = [
  { status: 'Applied', line: 'Where everything starts. Every application you send lands here.' },
  { status: 'Test', line: 'Online tests and assessments. Deadlines here are the ones that slip.' },
  { status: 'Interview', line: 'Rounds and conversations. Prepare a next step for each one.' },
  { status: 'Offer', line: 'Decide and reply. The reason the other layers exist.' },
  { status: 'Rejected', line: 'Closed, but every one is a lesson. Note what to improve.' },
]

/**
 * A pinned scroll story: the pipeline as a 3D stack of layers that rotates and pulls apart
 * as you scroll, walking through one stage at a time. useScrollFx drives --pin and data-step.
 */
export function PinScene({ data }: { data: Dashboard }) {
  const { counts } = data.summary
  const urgent = (s: Status) => data.items.filter((i) => i.status === s && i.action.needsAction).length

  return (
    <section className="pin-scene" data-pin data-step="0" aria-label="Your pipeline in 3D">
      <div className="pin-stick">
        <header className="pin-head">
          <span className="pin-kicker">Pipeline in 3D</span>
          <h2>Scroll to pull it apart</h2>
        </header>

        <div className="pin-stage" aria-hidden="true">
          <div className="pin-glow" />
          <div className="stack">
            {STACK.map(({ status, z, k }) => (
              <div key={status} className="slab" data-status={status} data-k={k} style={{ '--z': z } as React.CSSProperties}>
                <span className="slab-name">{status}</span>
                <strong className="slab-count mono">{String(counts[status]).padStart(2, '0')}</strong>
              </div>
            ))}
          </div>
        </div>

        <ol className="pin-story">
          {STORY.map((s, i) => (
            <li key={s.status} data-k={i}>
              <span className="pin-n mono">0{i + 1}</span>
              <h3>{s.status}</h3>
              <p>{s.line}</p>
              <p className="pin-num mono">
                {counts[s.status]} {counts[s.status] === 1 ? 'application' : 'applications'}
                {urgent(s.status) > 0 ? ` · ${urgent(s.status)} need action` : ''}
              </p>
            </li>
          ))}
        </ol>

        <div className="pin-meter" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  )
}
