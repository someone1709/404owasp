// The role dropdown in the application form. Anything else is typed under "Other".
export const ROLES = [
  'SDE Intern',
  'Frontend Intern',
  'Backend Intern',
  'Full Stack Intern',
  'Mobile App Intern',
  'Data Analyst Intern',
  'ML / AI Intern',
  'DevOps / Cloud Intern',
  'QA / Test Intern',
  'Security Intern',
  'Product Management Intern',
  'UI / UX Design Intern',
]

export const OTHER_ROLE = '__other__'

export const isListedRole = (role) => ROLES.includes(role)
