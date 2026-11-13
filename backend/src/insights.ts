// Funnel and drop-off insights, built from each application's status history.

import type { ApplicationRecord, FunnelStage, Insights } from './types.ts'

export const MIN_GROUP = 3 // never draw a conclusion from fewer applications than this

const FUNNEL: FunnelStage[] = ['Applied', 'Test', 'Interview', 'Offer']
const RANK: Record<FunnelStage, number> = { Applied: 0, Test: 1, Interview: 2, Offer: 3 }

const STAGE_NAME: Record<FunnelStage, string> = {
  Applied: 'resume screen',
  Test: 'online test',
  Interview: 'interview',
  Offer: 'offer',
}

const STAGE_TIP: Record<FunnelStage, string> = {
  Applied: 'Tailor your resume to each role; you are being filtered before any test.',
  Test: 'Practise timed online assessments (DSA + aptitude) a few times a week.',
  Interview: 'Do mock interviews and prepare a deep-dive on your best project.',
  Offer: 'Compare offers early and reply before the deadline.',
}

/** The furthest stage an application ever reached, ignoring Rejected. */
export function furthestStage(record: ApplicationRecord): FunnelStage {
  let best: FunnelStage = 'Applied'
  for (const { status } of record.history) {
    if (status !== 'Rejected' && RANK[status] > RANK[best]) best = status
  }
  return best
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/** Share of each group that reached Interview or further, for groups big enough to trust. */
function interviewRates(records: ApplicationRecord[], groupOf: (r: ApplicationRecord) => string) {
  const groups = new Map<string, { n: number; reached: number }>()
  for (const r of records) {
    const g = groups.get(groupOf(r)) ?? { n: 0, reached: 0 }
    g.n++
    if (RANK[furthestStage(r)] >= RANK.Interview) g.reached++
    groups.set(groupOf(r), g)
  }
  return [...groups]
    .filter(([, g]) => g.n >= MIN_GROUP)
    .map(([name, g]) => ({ name, n: g.n, rate: pct(g.reached, g.n) }))
    .sort((a, b) => b.rate - a.rate)
}

export function buildInsights(records: ApplicationRecord[]): Insights {
  const live = records.filter((r) => !r.deletedAt)
  const reached = live.map(furthestStage)

  const funnel = FUNNEL.map((stage) => {
    const count = reached.filter((s) => RANK[s] >= RANK[stage]).length
    return { stage, count, pct: pct(count, live.length) }
  })

  const messages: Insights['messages'] = []

  // 1. Where rejections happen.
  const rejected = live.filter((r) => r.status === 'Rejected')
  if (rejected.length >= 2) {
    const atStage = new Map<FunnelStage, ApplicationRecord[]>()
    for (const r of rejected) {
      const stage = furthestStage(r)
      atStage.set(stage, [...(atStage.get(stage) ?? []), r])
    }
    const [stage, group] = [...atStage].sort((a, b) => b[1].length - a[1].length)[0]
    let text = `${group.length} of ${rejected.length} rejections came after the ${STAGE_NAME[stage]}`
    const product = group.filter((r) => r.companyType === 'Product').length
    const service = group.filter((r) => r.companyType === 'Service').length
    const startup = group.length - product - service
    const [topType, topCount] = (
      [['Product', product], ['Service', service], ['Startup', startup]] as const
    ).reduce((a, b) => (b[1] > a[1] ? b : a))
    if (group.length >= 2 && topCount === group.length) text += `, all at ${topType} companies`
    else if (group.length >= 3 && topCount > group.length / 2) text += `, mostly at ${topType} companies`
    messages.push({ tone: 'warn', text: `${text}.`, tip: STAGE_TIP[stage] })
  }

  // 2. Which source gets interviews.
  const bySource = interviewRates(live, (r) => r.source)
  if (bySource.length >= 2 && bySource[0].rate > bySource.at(-1)!.rate) {
    const best = bySource[0]
    const worst = bySource.at(-1)!
    messages.push({
      tone: 'good',
      text: `${best.name} applications reach interview ${best.rate}% of the time, vs ${worst.rate}% for ${worst.name}.`,
      tip: `Spend more of your time on ${best.name.toLowerCase()} applications.`,
    })
  }

  // 3. Which resume version works.
  const byResume = interviewRates(live, (r) => r.resumeVersion)
  if (byResume.length >= 2 && byResume[0].rate > byResume.at(-1)!.rate) {
    const best = byResume[0]
    const worst = byResume.at(-1)!
    messages.push({
      tone: 'good',
      text: `Resume "${best.name}" gets you to interview ${best.rate}% of the time, vs ${worst.rate}% for "${worst.name}".`,
      tip: `Make "${best.name}" your default resume.`,
    })
  }

  if (messages.length === 0) {
    messages.push({
      tone: 'info',
      text: `Add a few more applications to unlock insights (${MIN_GROUP}+ per group).`,
    })
  }

  return { funnel, messages }
}
