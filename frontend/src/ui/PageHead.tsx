import type { ReactNode } from 'react'
import { Split } from './Split'

export function PageHead({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>
          <Split lines={[title]} />
        </h1>
        <p>{sub}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
