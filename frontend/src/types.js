// API contract. Keep in sync with backend/src/types.js.
// The constants are real values used at runtime; the shapes are JSDoc typedefs (editors read them for hints).

export const STATUSES = ['Applied', 'Test', 'Interview', 'Offer', 'Rejected']

export const SOURCES = ['Referral', 'Campus', 'Job board', 'Company site', 'Cold email']

export const COMPANY_TYPES = ['Product', 'Service', 'Startup']

/** @typedef {'Applied' | 'Test' | 'Interview' | 'Offer' | 'Rejected'} Status */
/** @typedef {'Referral' | 'Campus' | 'Job board' | 'Company site' | 'Cold email'} Source */
/** @typedef {'Product' | 'Service' | 'Startup'} CompanyType */
/** @typedef {'overdue' | 'soon' | 'stale' | 'ok' | 'closed'} Severity */

/**
 * @typedef {object} Application
 * @property {string} id
 * @property {string} company
 * @property {string} role
 * @property {string} deadline 'YYYY-MM-DD'
 * @property {Status} status
 * @property {{ status: Status, at: string }[]} history
 * @property {Source} source
 * @property {string} resumeVersion
 * @property {CompanyType} companyType
 * @property {string} [link]
 * @property {string} [notes]
 * @property {string} [nextActionMemo] the student's own next step; show it instead of action.nextStep when set
 * @property {string} createdAt
 * @property {object} action computed by the backend for ?today
 * @property {boolean} action.needsAction
 * @property {Severity} action.severity
 * @property {string} action.badge "Due in 2 days", "Overdue by 1 day", "No reply in 16 days", "Due 24 Nov", "Closed"
 * @property {string | null} action.reason why it needs action; null when nothing is urgent
 * @property {string} action.nextStep suggested step, used when there is no memo
 * @property {number} action.daysLeft
 * @property {number} action.urgency
 */

/**
 * @typedef {Pick<Application, 'company' | 'role' | 'deadline' | 'status' | 'source' | 'resumeVersion' | 'companyType' | 'link' | 'notes' | 'nextActionMemo'>} ApplicationDraft
 */

/**
 * @typedef {object} Dashboard
 * @property {string} today
 * @property {Application[]} items sorted by urgency, most urgent first
 * @property {{ counts: Record<Status, number>, total: number, active: number, needsAction: number }} summary
 * @property {{ id: string, company: string, role: string, deadline: string, daysLeft: number, severity: Severity }[]} deadlines
 * @property {{ funnel: { stage: Exclude<Status, 'Rejected'>, count: number, pct: number }[], messages: { tone: 'warn' | 'good' | 'info', text: string, tip?: string }[] }} insights
 */

/** Per-field validation messages from a 400 response.
 * @typedef {Partial<Record<keyof ApplicationDraft, string>>} FieldErrors
 */

/** @typedef {'all' | 'action' | Status} Filter which applications the list shows */

/**
 * What a card can do. Implemented in App.jsx and passed down to the pages.
 * @typedef {object} CardActions
 * @property {(app: Application, status: Status) => void} onStatus
 * @property {(app: Application, text: string) => Promise<void>} onMemo
 * @property {(app: Application) => void} onEdit
 * @property {(app: Application) => void} onDelete
 */

/**
 * Everything a page needs. State lives in App so it survives moving between pages.
 * @typedef {object} PageProps
 * @property {Dashboard} data
 * @property {Application[]} visible data.items after the filter + search
 * @property {Filter} filter
 * @property {(f: Filter) => void} setFilter
 * @property {string} query
 * @property {(q: string) => void} setQuery
 * @property {string | null} flashId
 * @property {CardActions} actions
 * @property {() => void} openNew
 * @property {(id: string) => void} jumpTo
 * @property {() => void} exportIcs
 * @property {() => void} resetDemo
 * @property {(text: string, tone?: 'info' | 'error') => void} notify
 * @property {'list' | 'board'} view
 * @property {(v: 'list' | 'board') => void} setView
 * @property {User | null} user the signed-in account, if any
 */

/**
 * The signed-in account (accounts are optional).
 * @typedef {object} User
 * @property {string} id
 * @property {string} email
 * @property {string} [name]
 */
