// Shared vocabulary and data shapes. The constants are real values used at runtime; the shapes are
// documented below as JSDoc typedefs (editors read them for hints) so the API contract stays written down.

export const STATUSES = ['Applied', 'Test', 'Interview', 'Offer', 'Rejected']

export const SOURCES = ['Referral', 'Campus', 'Job board', 'Company site', 'Cold email']

export const COMPANY_TYPES = ['Product', 'Service', 'Startup']

/** @typedef {'Applied' | 'Test' | 'Interview' | 'Offer' | 'Rejected'} Status */
/** @typedef {'Referral' | 'Campus' | 'Job board' | 'Company site' | 'Cold email'} Source */
/** @typedef {'Product' | 'Service' | 'Startup'} CompanyType */
/** @typedef {'overdue' | 'soon' | 'stale' | 'ok' | 'closed'} Severity */

/**
 * One status change in an application's history.
 * @typedef {object} StatusChange
 * @property {Status} status
 * @property {string} at ISO timestamp
 */

/**
 * What the store keeps. Everything date-relative is computed per request.
 * @typedef {object} ApplicationRecord
 * @property {string} id
 * @property {string} company
 * @property {string} role
 * @property {string} deadline 'YYYY-MM-DD'
 * @property {Status} status
 * @property {StatusChange[]} history every status change, oldest first
 * @property {Source} source
 * @property {string} resumeVersion
 * @property {CompanyType} companyType
 * @property {string} [link]
 * @property {string} [notes]
 * @property {string} [nextActionMemo] the student's own next step, e.g. "Email HR for a new test link"
 * @property {string} createdAt ISO timestamp
 * @property {string} [deletedAt] soft delete, so Undo can restore it
 */

/**
 * The only fields a client may set. Anything else in a request body is ignored.
 * @typedef {Pick<ApplicationRecord, 'company' | 'role' | 'deadline' | 'status' | 'source' | 'resumeVersion' | 'companyType' | 'link' | 'notes' | 'nextActionMemo'>} ApplicationDraft
 */

/**
 * @typedef {object} ActionInfo
 * @property {boolean} needsAction
 * @property {Severity} severity
 * @property {string} badge
 * @property {string | null} reason
 * @property {string} nextStep suggested step; the UI shows nextActionMemo instead when the student set one
 * @property {number} daysLeft
 * @property {number} urgency
 */

/**
 * What the API returns for one application.
 * @typedef {Omit<ApplicationRecord, 'deletedAt'> & { action: ActionInfo }} Application
 */

/**
 * @typedef {object} Summary
 * @property {Record<Status, number>} counts
 * @property {number} total
 * @property {number} active everything except Rejected
 * @property {number} needsAction
 */

/**
 * @typedef {object} DeadlineItem
 * @property {string} id
 * @property {string} company
 * @property {string} role
 * @property {string} deadline
 * @property {number} daysLeft
 * @property {Severity} severity
 */

/** @typedef {Exclude<Status, 'Rejected'>} FunnelStage */

/**
 * @typedef {object} Insights
 * @property {{ stage: FunnelStage, count: number, pct: number }[]} funnel
 * @property {{ tone: 'warn' | 'good' | 'info', text: string, tip?: string }[]} messages
 */

/**
 * @typedef {object} Dashboard
 * @property {string} today
 * @property {Application[]} items sorted by urgency, most urgent first
 * @property {Summary} summary
 * @property {DeadlineItem[]} deadlines
 * @property {Insights} insights
 */
