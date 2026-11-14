import { AppCard } from './Card'

export function CardList({ items, today, flashId, actions }) {
  return (
    <div className="cards">
      {items.map((app) => (
        <AppCard
          key={app.id}
          app={app}
          today={today}
          flash={flashId === app.id}
          onStatus={actions.onStatus}
          onMemo={actions.onMemo}
          onEdit={actions.onEdit}
          onDelete={actions.onDelete}
        />
      ))}
    </div>
  )
}
