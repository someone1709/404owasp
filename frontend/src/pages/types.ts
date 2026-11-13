import type { Application, Dashboard, Status } from '../types'
import type { Filter } from '../ui/Overview'

export interface CardActions {
  onStatus: (app: Application, status: Status) => void
  onMemo: (app: Application, text: string) => Promise<void>
  onEdit: (app: Application) => void
  onDelete: (app: Application) => void
}

/** Everything a page needs. State lives in App so it survives moving between pages. */
export interface PageProps {
  data: Dashboard
  visible: Application[] // data.items after the filter + search
  filter: Filter
  setFilter: (f: Filter) => void
  query: string
  setQuery: (q: string) => void
  flashId: string | null
  actions: CardActions
  openNew: () => void
  jumpTo: (id: string) => void
  exportIcs: () => void
  resetDemo: () => void
}
