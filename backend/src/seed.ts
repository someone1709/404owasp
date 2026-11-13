// Fictional demo data (Rule 04). Every date is relative to "today", so the
// demo shows the same urgent items on whatever day the judges open it.
// Company domains use the reserved .example TLD.

import { randomUUID } from 'node:crypto'
import { addDays, timestampOn } from './dates.ts'
import type { ApplicationRecord, CompanyType, Source, Status } from './types.ts'

type SeedRow = {
  company: string
  role: string
  deadlineIn: number // days from today; negative = past
  history: [Status, number][] // [status, days ago], oldest first
  source: Source
  resumeVersion: string
  companyType: CompanyType
  notes?: string
  memo?: string // the student's own next-action memo
}

const ROWS: SeedRow[] = [
  { company: 'Nimbus Labs', role: 'SDE Intern', deadlineIn: 2, history: [['Applied', 12], ['Test', 3]], source: 'Referral', resumeVersion: 'v2-backend', companyType: 'Product', notes: '90-minute coding test, 3 questions.', memo: 'Revise graphs + DP, then take the test Sunday morning' },
  { company: 'Kestrel Pay', role: 'Backend Intern', deadlineIn: 1, history: [['Applied', 20], ['Test', 14], ['Interview', 5]], source: 'Referral', resumeVersion: 'v2-backend', companyType: 'Startup', notes: 'Round 2: system design basics + project deep-dive.', memo: 'Prepare a 2-minute walkthrough of the chat-app project' },
  { company: 'Pebble Health', role: 'ML Intern', deadlineIn: -1, history: [['Applied', 10], ['Test', 4]], source: 'Campus', resumeVersion: 'v1-general', companyType: 'Product', notes: 'Test link stopped working on day 2.', memo: 'Email the placement cell for a new test link' },
  { company: 'Saffron Cloud', role: 'Security Intern', deadlineIn: 6, history: [['Applied', 30], ['Test', 24], ['Interview', 15], ['Offer', 2]], source: 'Campus', resumeVersion: 'v2-backend', companyType: 'Service', notes: 'Stipend ₹25k/month. Reply to HR by email.', memo: 'Ask HR if the start date can move to January' },
  { company: 'Quarkline', role: 'SDE Intern', deadlineIn: 18, history: [['Applied', 16]], source: 'Job board', resumeVersion: 'v1-general', companyType: 'Product' },
  { company: 'Lumen Grid', role: 'Data Analyst Intern', deadlineIn: 5, history: [['Applied', 14], ['Test', 9], ['Interview', 2]], source: 'Campus', resumeVersion: 'v1-general', companyType: 'Service' },
  { company: 'Driftwood Analytics', role: 'Data Science Intern', deadlineIn: 9, history: [['Applied', 18], ['Interview', 6]], source: 'Referral', resumeVersion: 'v2-backend', companyType: 'Startup' },
  { company: 'Orbitly', role: 'Product Intern', deadlineIn: 12, history: [['Applied', 4]], source: 'Cold email', resumeVersion: 'v1-general', companyType: 'Startup' },
  { company: 'Tessellate AI', role: 'ML Intern', deadlineIn: -22, history: [['Applied', 35], ['Test', 28], ['Rejected', 22]], source: 'Job board', resumeVersion: 'v1-general', companyType: 'Product' },
  { company: 'Bluefin Systems', role: 'SDE Intern', deadlineIn: -27, history: [['Applied', 40], ['Test', 33], ['Rejected', 27]], source: 'Job board', resumeVersion: 'v1-general', companyType: 'Product' },
  { company: 'Cobalt Forge', role: 'Backend Intern', deadlineIn: -20, history: [['Applied', 30], ['Test', 25], ['Rejected', 20]], source: 'Company site', resumeVersion: 'v1-general', companyType: 'Product' },
  { company: 'Vantage Rail', role: 'Data Analyst Intern', deadlineIn: -18, history: [['Applied', 26], ['Rejected', 18]], source: 'Job board', resumeVersion: 'v1-general', companyType: 'Service' },
  { company: 'Marrow & Pine', role: 'Frontend Intern', deadlineIn: -7, history: [['Applied', 22], ['Test', 17], ['Interview', 10], ['Rejected', 7]], source: 'Referral', resumeVersion: 'v2-backend', companyType: 'Product' },
]

function slug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function seedApplications(today: string): ApplicationRecord[] {
  return ROWS.map((row) => {
    const history = row.history.map(([status, ago]) => ({ status, at: timestampOn(addDays(today, -ago)) }))
    return {
      id: randomUUID(),
      company: row.company,
      role: row.role,
      deadline: addDays(today, row.deadlineIn),
      status: history.at(-1)!.status,
      history,
      source: row.source,
      resumeVersion: row.resumeVersion,
      companyType: row.companyType,
      link: `https://careers.${slug(row.company)}.example/internships`,
      notes: row.notes,
      nextActionMemo: row.memo,
      createdAt: history[0].at,
    }
  })
}
