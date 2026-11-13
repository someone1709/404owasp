import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { deleteResume, downloadResume, putResume, useResumes } from '../resumeStore'
import type { ResumeFile } from '../resumeStore'
import type { Application } from '../types'
import { DropZone, FileChip } from '../ui/DropZone'
import { PageHead } from '../ui/PageHead'
import type { PageProps } from './types'

const reached = (app: Application, stage: 'Interview' | 'Offer') =>
  app.history.some((h) => h.status === stage || (stage === 'Interview' && h.status === 'Offer'))

interface Row {
  version: string
  file?: ResumeFile
  apps: number
  interviews: number
  offers: number
  rate: number
}

export function ResumePage({ data, notify }: PageProps) {
  const { files, error } = useResumes()
  const [version, setVersion] = useState('v1-general')

  const rows = useMemo<Row[]>(() => {
    const versions = new Set<string>([...data.items.map((i) => i.resumeVersion), ...files.map((f) => f.version)])
    return [...versions]
      .map((v) => {
        const used = data.items.filter((i) => i.resumeVersion === v)
        const interviews = used.filter((i) => reached(i, 'Interview')).length
        return {
          version: v,
          file: files.find((f) => f.version === v),
          apps: used.length,
          interviews,
          offers: used.filter((i) => reached(i, 'Offer')).length,
          rate: used.length ? Math.round((interviews / used.length) * 100) : 0,
        }
      })
      .sort((a, b) => b.rate - a.rate || b.apps - a.apps)
  }, [data.items, files])

  // Same rule as the backend insights: only call a winner with 3+ applications behind it.
  const best = rows.find((r) => r.apps >= 3 && r.rate > 0)

  async function save(label: string, file: File) {
    const v = label.trim() || 'v1-general'
    try {
      await putResume(v, file)
      notify(`Resume ${v} saved in this browser`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save the resume', 'error')
    }
  }

  async function remove(f: ResumeFile) {
    if (!window.confirm(`Remove ${f.name} from this browser?`)) return
    try {
      await deleteResume(f.version)
      notify(`Removed ${f.name}`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not remove the file', 'error')
    }
  }

  return (
    <div className="page-narrow">
      <PageHead
        title="Resume Lab"
        sub="Keep every version of your resume in one place and see which one actually gets you interviews."
      />

      <section className="card lab-drop">
        <div className="lab-drop-head">
          <h2>
            <Icon name="upload" size={18} className="accent" /> Add or replace a resume
          </h2>
          <span className="privacy-chip">
            <Icon name="lock" size={14} /> Stored in this browser only · never uploaded
          </span>
        </div>
        <div className="lab-drop-body">
          <div className="field">
            <div className="field-label">
              <label htmlFor="lab-version">Resume version</label>
            </div>
            <input
              id="lab-version"
              className="lab-input"
              value={version}
              maxLength={30}
              list="lab-versions"
              autoComplete="off"
              onChange={(e) => setVersion(e.target.value)}
            />
            <datalist id="lab-versions">
              {rows.map((r) => (
                <option key={r.version} value={r.version} />
              ))}
            </datalist>
            <p className="field-hint">The file is saved under this label and matched to applications that use it.</p>
          </div>
          <DropZone onFile={(f) => void save(version, f)} />
        </div>
        {error && <p className="field-error">{error}</p>}
      </section>

      <div className="section-head lab-head">
        <h2>Your versions</h2>
        <span className="muted small">Interview rate = applications that reached an interview</span>
      </div>

      {rows.length === 0 ? (
        <div className="card empty">
          <h3>No resumes yet</h3>
          <p className="muted">Drop a file above, or add an application with a resume version to start tracking.</p>
        </div>
      ) : (
        <div className="lab-grid">
          {rows.map((r) => (
            <article key={r.version} className="card lab-card" data-best={best?.version === r.version}>
              <header>
                <h3 className="mono">{r.version}</h3>
                {best?.version === r.version && (
                  <span className="best-tag">
                    <Icon name="sparkle" size={12} /> Best interview rate
                  </span>
                )}
              </header>

              <div className="lab-stats">
                <div>
                  <strong>{r.apps}</strong>
                  <span>applications</span>
                </div>
                <div>
                  <strong>{r.interviews}</strong>
                  <span>interviews</span>
                </div>
                <div>
                  <strong>{r.offers}</strong>
                  <span>offers</span>
                </div>
              </div>

              <div className="rate" aria-label={`${r.rate}% reached an interview`}>
                <span className="rate-track">
                  <span style={{ width: `${r.rate}%` }} />
                </span>
                <span className="mono">{r.apps ? `${r.rate}%` : '—'}</span>
              </div>

              {r.file ? (
                <FileChip
                  name={r.file.name}
                  size={r.file.size}
                  tag={new Date(r.file.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  onDownload={() => downloadResume(r.file!)}
                  onRemove={() => void remove(r.file!)}
                />
              ) : (
                <DropZone compact title="No file yet. Drop one here" onFile={(f) => void save(r.version, f)} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
