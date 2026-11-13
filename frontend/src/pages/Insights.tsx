import { FunnelCard } from '../ui/Overview'
import { PageHead } from '../ui/PageHead'
import { Insights } from '../ui/Side'
import type { PageProps } from './types'

export function InsightsPage({ data }: PageProps) {
  return (
    <>
      <PageHead
        title="Insights"
        sub="Where your applications get stuck, and which sources and resume versions get you to interviews."
      />
      <div className="insights-grid">
        <FunnelCard funnel={data.insights.funnel} />
        <Insights data={data} />
      </div>
    </>
  )
}
