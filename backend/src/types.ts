export const STATUSES = ['Applied', 'Test', 'Interview', 'Offer', 'Rejected'] as const
export type Status = (typeof STATUSES)[number]

export const SOURCES = ['Referral', 'Campus', 'Job board', 'Company site', 'Cold email'] as const
export type Source = (typeof SOURCES)[number]

export const COMPANY_TYPES = ['Product', 'Service', 'Startup'] as const
export type CompanyType = (typeof COMPANY_TYPES)[number]

export type Severity = 'overdue' | 'soon' | 'stale' | 'ok' | 'closed'

export interface StatusChange {
  status: Status
  at: string // ISO timestamp
}

/** What the store keeps. Everything date-relative is computed per request. */
export interface ApplicationRecord {
  id: string
  company: string
  role: string
  deadline: string // 'YYYY-MM-DD'
  status: Status
  history: StatusChange[] // every status change, oldest first
  source: Source
  resumeVersion: string
  companyType: CompanyType
  link?: string
  notes?: string
  nextActionMemo?: string // the student's own next step, e.g. "Email HR for a new test link"
  createdAt: string
  deletedAt?: string // soft delete, so Undo can restore it
}

/** The only fields a client may set. Anything else in a request body is ignored. */
export type ApplicationDraft = Pick<
  ApplicationRecord,
  'company' | 'role' | 'deadline' | 'status' | 'source' | 'resumeVersion' | 'companyType' | 'link' | 'notes' | 'nextActionMemo'
>

export interface ActionInfo {
  needsAction: boolean
  severity: Severity
  badge: string
  reason: string | null
  nextStep: string // suggested step; the UI shows nextActionMemo instead when the student set one
  daysLeft: number
  urgency: number
}

/** What the API returns for one application. */
export interface Application extends Omit<ApplicationRecord, 'deletedAt'> {
  action: ActionInfo
}

export interface Summary {
  counts: Record<Status, number>
  total: number
  active: number
  needsAction: number
}

export interface DeadlineItem {
  id: string
  company: string
  role: string
  deadline: string
  daysLeft: number
  severity: Severity
}

export type FunnelStage = Exclude<Status, 'Rejected'>

export interface Insights {
  funnel: { stage: FunnelStage; count: number; pct: number }[]
  messages: { tone: 'warn' | 'good' | 'info'; text: string; tip?: string }[]
}

export interface Dashboard {
  today: string
  items: Application[]
  summary: Summary
  deadlines: DeadlineItem[]
  insights: Insights
}
