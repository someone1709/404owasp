import { Icon } from '../icons'
import { Link, useRoute } from '../router'
import { CardList } from '../ui/CardList'
import { NextUp } from '../ui/NextUp'
import { Hero, SummaryTiles } from '../ui/Overview'
import { PinScene } from '../ui/PinScene'
import { Deadlines } from '../ui/Side'
import { Ticker } from '../ui/Ticker'

const PREVIEW = 3

/** Overview: the day at a glance. The full lists live on their own pages. */
export function HomePage({ data, setFilter, flashId, actions, jumpTo, exportIcs }) {
  const { navigate } = useRoute()
  const urgent = data.items.filter((i) => i.action.needsAction)
  const shown = urgent.slice(0, PREVIEW)

  return (
    <>
      <Hero data={data} />
      <Ticker data={data} />
      <SummaryTiles
        data={data}
        filter="all"
        onFilter={(f) => {
          setFilter(f) // a tile opens the Applications page already filtered to that status
          navigate('/applications')
        }}
      />

      <div className="columns">
        <section aria-label="Needs your attention">
          {urgent[0] && <NextUp app={urgent[0]} today={data.today} onOpen={jumpTo} />}
          <div className="section-head">
            <h2>Needs your attention</h2>
            <Link to="/applications" className="link-more" onClick={() => setFilter(data.summary.needsAction ? 'action' : 'all')}>
              {data.summary.needsAction > PREVIEW ? `See all ${data.summary.needsAction}` : 'Open applications'}
              <Icon name="arrow" size={15} />
            </Link>
          </div>

          {data.summary.total === 0 ? (
            <div className="card empty">
              <h3>No applications yet</h3>
              <p className="muted">Add one to see what needs action next, or load the demo data to explore.</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="card empty">
              <h3>You're all caught up ✓</h3>
              <p className="muted">Nothing is overdue, due within 3 days, or waiting on a follow-up.</p>
            </div>
          ) : (
            <CardList items={shown.slice(urgent[0] ? 1 : 0)} today={data.today} flashId={flashId} actions={actions} />
          )}
        </section>

        <aside className="side-col">
          <Deadlines data={data} onJump={jumpTo} onExport={exportIcs} />
        </aside>
      </div>

      <PinScene data={data} />
    </>
  )
}
