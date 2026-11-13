// API contract. Keep in sync with backend/src/types.ts.

export const STATUSES = ['Applied', 'Test', 'Interview', 'Offer', 'Rejected'] as const
export type Status = (typeof STATUSES)[number]

export const SOURCES = ['Referral', 'Campus', 'Job board', 'Company site', 'Cold email'] as const
export type Source = (typeof SOURCES)[number]

export const COMPANY_TYPES = ['Product', 'Service', 'Startup'] as const
export type CompanyType = (typeof COMPANY_TYPES)[number]

export type Severity = 'overdue' | 'soon' | 'stale' | 'ok' | 'closed'

export interface Application {
  id: string
  company: string
  role: string
  deadline: string // 'YYYY-MM-DD'
  status: Status
  history: { status: Status; at: string }[]
  source: Source
  resumeVersion: string
  companyType: CompanyType
  link?: string
  notes?: string
  nextActionMemo?: string // the student's own next step; show it instead of action.nextStep when set
  createdAt: string
  action: {
    needsAction: boolean
    severity: Severity
    badge: string // "Due in 2 days", "Overdue by 1 day", "No reply in 16 days", "Due 24 Nov", "Closed"
    reason: string | null // why it needs action; null when nothing is urgent
    nextStep: string // suggested step, used when there is no memo
    daysLeft: number
    urgency: number
  }
}

export type ApplicationDraft = Pick<
  Application,
  'company' | 'role' | 'deadline' | 'status' | 'source' | 'resumeVersion' | 'companyType' | 'link' | 'notes' | 'nextActionMemo'
>

export interface Dashboard {
  today: string
  items: Application[] // sorted by urgency, most urgent first
  summary: {
    counts: Record<Status, number>
    total: number
    active: number
    needsAction: number
  }
  deadlines: {
    id: string
    company: string
    role: string
    deadline: string
    daysLeft: number
    severity: Severity
  }[]
  insights: {
    funnel: { stage: Exclude<Status, 'Rejected'>; count: number; pct: number }[]
    messages: { tone: 'warn' | 'good' | 'info'; text: string; tip?: string }[]
  }
}

export type FieldErrors = Partial<Record<keyof ApplicationDraft, string>>
