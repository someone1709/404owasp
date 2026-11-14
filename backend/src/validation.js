// Input validation. The server is the source of truth: the frontend mirrors
// these rules for instant feedback, but never gets to skip them.

import { diffDays, isValidISODate } from './dates.js'
import { COMPANY_TYPES, SOURCES, STATUSES } from './types.js'

export const LIMITS = { company: 60, role: 60, resumeVersion: 30, link: 300, notes: 500, nextActionMemo: 140 }

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

function cleanText(value, multiline = false) {
  if (typeof value !== 'string') return ''
  const text = value.replace(CONTROL_CHARS, '')
  return (multiline ? text : text.replace(/\s+/g, ' ')).trim()
}

function oneOf(options, value) {
  return typeof value === 'string' && options.includes(value)
}

/** Only http(s) links, so a stored link can never become a `javascript:` XSS. */
export function isSafeHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function isStatus(value) {
  return oneOf(STATUSES, value)
}

/** The next-action memo: one short line. Empty clears it. */
export function validateMemo(value) {
  if (value !== undefined && value !== null && typeof value !== 'string') return { ok: false, error: 'Memo must be text' }
  const memo = cleanText(value)
  if (memo.length > LIMITS.nextActionMemo) return { ok: false, error: `Keep the memo under ${LIMITS.nextActionMemo} characters` }
  return { ok: true, memo: memo || undefined }
}

export function validateDraft(body, today) {
  // Pick known fields only: a client can never set id, history or createdAt.
  const input = body && typeof body === 'object' ? body : {}
  const errors = {}

  const company = cleanText(input.company)
  if (!company) errors.company = 'Company is required'
  else if (company.length > LIMITS.company) errors.company = `Keep it under ${LIMITS.company} characters`

  const role = cleanText(input.role)
  if (!role) errors.role = 'Role is required'
  else if (role.length > LIMITS.role) errors.role = `Keep it under ${LIMITS.role} characters`

  const deadline = cleanText(input.deadline)
  if (!deadline) errors.deadline = 'Pick a deadline'
  else if (!isValidISODate(deadline)) errors.deadline = 'Use a valid date (YYYY-MM-DD)'
  else if (Math.abs(diffDays(today, deadline)) > 366) errors.deadline = 'Pick a date within a year of today'

  const status = input.status ?? 'Applied'
  if (!isStatus(status)) errors.status = 'Choose a valid status'

  const source = input.source ?? 'Job board'
  if (!oneOf(SOURCES, source)) errors.source = 'Choose a valid source'

  const companyType = input.companyType ?? 'Product'
  if (!oneOf(COMPANY_TYPES, companyType)) errors.companyType = 'Choose Product, Service or Startup'

  const resumeVersion = cleanText(input.resumeVersion) || 'v1-general'
  if (resumeVersion.length > LIMITS.resumeVersion) errors.resumeVersion = `Keep it under ${LIMITS.resumeVersion} characters`

  const link = cleanText(input.link)
  if (link.length > LIMITS.link) errors.link = 'That link is too long'
  else if (link && !isSafeHttpUrl(link)) errors.link = 'Only http:// or https:// links are allowed'

  const notes = cleanText(input.notes, true)
  if (notes.length > LIMITS.notes) errors.notes = `Keep notes under ${LIMITS.notes} characters`

  const memo = validateMemo(input.nextActionMemo)
  if (!memo.ok) errors.nextActionMemo = memo.error

  if (Object.keys(errors).length > 0 || !memo.ok) return { ok: false, errors }

  return {
    ok: true,
    draft: {
      company,
      role,
      deadline,
      status: status,
      source: source,
      companyType: companyType,
      resumeVersion,
      link: link || undefined,
      notes: notes || undefined,
      nextActionMemo: memo.memo,
    },
  }
}
