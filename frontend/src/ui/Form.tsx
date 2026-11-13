import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api, ApiError } from '../api'
import { Icon } from '../icons'
import { COMPANY_TYPES, SOURCES, STATUSES } from '../types'
import type { Application, ApplicationDraft, FieldErrors } from '../types'

const LIMITS = { company: 60, role: 60, resumeVersion: 30, link: 300, notes: 500, nextActionMemo: 140 }

const EMPTY: ApplicationDraft = {
  company: '',
  role: '',
  deadline: '',
  status: 'Applied',
  source: 'Job board',
  resumeVersion: 'v1-general',
  companyType: 'Product',
  link: '',
  notes: '',
  nextActionMemo: '',
}

function fromApp(app: Application): ApplicationDraft {
  return {
    company: app.company,
    role: app.role,
    deadline: app.deadline,
    status: app.status,
    source: app.source,
    resumeVersion: app.resumeVersion,
    companyType: app.companyType,
    link: app.link ?? '',
    notes: app.notes ?? '',
    nextActionMemo: app.nextActionMemo ?? '',
  }
}

function Field({
  label,
  name,
  required,
  hint,
  error,
  wide,
  aside,
  children,
}: {
  label: string
  name: string
  required?: boolean
  hint?: string
  error?: string
  wide?: boolean
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`field${wide ? ' wide' : ''}${error ? ' has-error' : ''}`}>
      <div className="field-label">
        <label htmlFor={`f-${name}`}>
          {label}
          {required && <span className="req"> *</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="field-error" id={`f-${name}-err`}>
          <Icon name="warn" size={14} /> {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  )
}

interface FormProps {
  editing: Application | null // null = create
  resumeVersions: string[]
  onClose: () => void
  onSaved: (saved: Application, created: boolean) => void
}

export function AppForm({ editing, resumeVersions, onClose, onSaved }: FormProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const first = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<ApplicationDraft>(() => (editing ? fromApp(editing) : EMPTY))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
    first.current?.focus()
  }, [])

  const set = <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const text = (key: keyof ApplicationDraft) => ({
    id: `f-${key}`,
    name: key,
    value: (draft[key] as string | undefined) ?? '',
    maxLength: LIMITS[key as keyof typeof LIMITS],
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `f-${key}-err` : undefined,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      const saved = editing ? await api.update(editing.id, draft) : await api.create(draft)
      onSaved(saved, !editing)
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors(err.errors)
        const firstBad = Object.keys(err.errors)[0]
        if (firstBad) document.getElementById(`f-${firstBad}`)?.focus()
      } else {
        setFormError(err instanceof Error ? err.message : 'Could not save')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="form-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose() // click on the backdrop
      }}
    >
      <form onSubmit={submit} noValidate>
        <header className="modal-head">
          <span className="modal-icon">
            <Icon name="edit" size={20} />
          </span>
          <div>
            <h2 id="form-title">{editing ? 'Edit application' : 'New application'}</h2>
            <p>Track the deadline that matters next. NextUp works out what needs action and when.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="modal-grid">
          <Field label="Company" name="company" required error={errors.company}>
            <input {...text('company')} ref={first} placeholder="e.g. Nimbus Labs" autoComplete="off" />
          </Field>
          <Field label="Role" name="role" required error={errors.role}>
            <input {...text('role')} placeholder="e.g. SDE Intern" autoComplete="off" />
          </Field>

          <Field label="Status" name="status" error={errors.status}>
            <div className="select-wrap">
              <select id="f-status" value={draft.status} onChange={(e) => set('status', e.target.value as ApplicationDraft['status'])}>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <Icon name="chevron" size={16} />
            </div>
          </Field>
          <Field
            label="Next deadline"
            name="deadline"
            required
            error={errors.deadline}
            hint="Apply-by, test due date, interview date or offer reply date"
          >
            <input {...text('deadline')} type="date" />
          </Field>

          <Field label="Source" name="source" error={errors.source}>
            <div className="select-wrap">
              <select id="f-source" value={draft.source} onChange={(e) => set('source', e.target.value as ApplicationDraft['source'])}>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <Icon name="chevron" size={16} />
            </div>
          </Field>
          <Field label="Resume version" name="resumeVersion" error={errors.resumeVersion}>
            <input {...text('resumeVersion')} list="resume-versions" autoComplete="off" />
            <datalist id="resume-versions">
              {resumeVersions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>

          <Field label="Company type" name="companyType" error={errors.companyType}>
            <div className="segmented" role="radiogroup" aria-label="Company type" id="f-companyType">
              {COMPANY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={draft.companyType === t}
                  className={draft.companyType === t ? 'on' : ''}
                  onClick={() => set('companyType', t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Job link" name="link" error={errors.link}>
            <input {...text('link')} type="url" placeholder="https://" autoComplete="off" />
          </Field>

          <Field label="Next action" name="nextActionMemo" wide error={errors.nextActionMemo}>
            <input {...text('nextActionMemo')} placeholder="e.g. Email HR for a new test link" autoComplete="off" />
          </Field>
          <Field
            label="Notes"
            name="notes"
            wide
            error={errors.notes}
            aside={
              <span className="counter">
                {(draft.notes ?? '').length}/{LIMITS.notes}
              </span>
            }
          >
            <textarea {...text('notes')} rows={3} placeholder="Recruiter name, test format, anything worth remembering" />
          </Field>
        </div>

        {formError && (
          <p className="form-error" role="alert">
            <Icon name="alert" size={16} /> {formError}
          </p>
        )}

        <footer className="modal-foot">
          <span className="muted small">
            <span className="dot good" /> Saved to this browser's private workspace
          </span>
          <div className="modal-buttons">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save application'}
              <Icon name="check" size={16} />
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}
