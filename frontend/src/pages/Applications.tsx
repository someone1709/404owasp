import { Icon } from '../icons'
import { Board } from '../ui/Board'
import { CardList } from '../ui/CardList'
import { FilterBar, SummaryTiles } from '../ui/Overview'
import { PageHead } from '../ui/PageHead'
import type { PageProps } from './types'

export function ApplicationsPage({
  data,
  visible,
  filter,
  setFilter,
  query,
  setQuery,
  flashId,
  actions,
  openNew,
  resetDemo,
  view,
  setView,
}: PageProps) {
  // The board shows every stage at once, so it ignores the status filter but keeps Needs action and search.
  const q = query.trim().toLowerCase()
  const boardItems = data.items.filter(
    (i) => (filter !== 'action' || i.action.needsAction) && (!q || i.company.toLowerCase().includes(q) || i.role.toLowerCase().includes(q)),
  )

  return (
    <div className={view === 'board' ? 'page-wide' : 'page-narrow'}>
      <PageHead
        title="Applications"
        sub="Every internship you're tracking, most urgent first. Change a status or edit the next step right on the card."
        actions={
          <>
            <div className="view-toggle" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <Icon name="list" size={15} /> List
              </button>
              <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
                <Icon name="board" size={15} /> Board
              </button>
            </div>
            <button type="button" className="btn primary" onClick={openNew}>
              <Icon name="plus" size={16} /> New application
            </button>
          </>
        }
      />
      <SummaryTiles data={data} filter={filter} onFilter={setFilter} />
      <FilterBar data={data} filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />

      {data.summary.total === 0 ? (
        <div className="card empty">
          <h3>No applications yet</h3>
          <p className="muted">Add one to see what needs action next, or load the demo data to explore.</p>
          <div className="empty-actions">
            <button type="button" className="btn ghost" onClick={resetDemo}>
              <Icon name="reset" size={16} /> Load demo data
            </button>
            <button type="button" className="btn primary" onClick={openNew}>
              <Icon name="plus" size={16} /> Add your first application
            </button>
          </div>
        </div>
      ) : view === 'board' ? (
        <Board items={boardItems} flashId={flashId} onStatus={actions.onStatus} onEdit={actions.onEdit} />
      ) : visible.length === 0 ? (
        <div className="card empty">
          {filter === 'action' && !query ? (
            <>
              <h3>You're all caught up ✓</h3>
              <p className="muted">Nothing is overdue, due within 3 days, or waiting on a follow-up.</p>
            </>
          ) : (
            <>
              <h3>No matches</h3>
              <p className="muted">Try another filter or search.</p>
            </>
          )}
        </div>
      ) : (
        <CardList items={visible} today={data.today} flashId={flashId} actions={actions} />
      )}
    </div>
  )
}
