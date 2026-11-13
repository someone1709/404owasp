import { Icon } from '../icons'
import { CardList } from '../ui/CardList'
import { FilterBar, SummaryTiles } from '../ui/Overview'
import { PageHead } from '../ui/PageHead'
import type { PageProps } from './types'

export function ApplicationsPage({ data, visible, filter, setFilter, query, setQuery, flashId, actions, openNew, resetDemo }: PageProps) {
  return (
    <div className="page-narrow">
      <PageHead
        title="Applications"
        sub="Every internship you're tracking, most urgent first. Change a status or edit the next step right on the card."
        actions={
          <button type="button" className="btn primary" onClick={openNew}>
            <Icon name="plus" size={16} /> New application
          </button>
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
