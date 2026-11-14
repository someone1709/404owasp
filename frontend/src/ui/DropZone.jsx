import { useState } from 'react'

import { Icon } from '../icons'
import { RESUME_ACCEPT, formatSize, validateResume } from '../resumeStore'

/** Click-or-drop file target for resumes. Validates the file before handing it over. */
export function DropZone({ onFile, title, compact }) {
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')

  async function take(file) {
    if (!file) return
    const problem = await validateResume(file)
    setError(problem ?? '')
    if (!problem) onFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setOver(false)
    void take(e.dataTransfer.files[0])
  }

  return (
    <div className="drop-wrap">
      <label
        className={`drop${compact ? ' compact' : ''}${over ? ' over' : ''}`}
        data-cursor="Drop"
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          className="sr-only"
          accept={RESUME_ACCEPT}
          onChange={(e) => {
            void take(e.target.files?.[0])
            e.target.value = '' // let the same file be picked again
          }}
        />
        <span className="drop-icon">
          <Icon name="upload" size={compact ? 18 : 22} />
        </span>
        <span className="drop-copy">
          <strong>{title ?? 'Drop your resume here'}</strong>
          <span>
            or <u>browse</u> · PDF, DOC or DOCX · max 2 MB
          </span>
        </span>
      </label>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="warn" size={14} /> {error}
        </p>
      )}
    </div>
  )
}

export function FileChip({ name, size, tag, onRemove, onDownload, children }) {
  return (
    <div className="file-chip">
      <span className="file-icon">
        <Icon name="file" size={18} />
      </span>
      <span className="file-meta">
        <strong title={name}>{name}</strong>
        <span>
          {formatSize(size)}
          {tag ? ` · ${tag}` : ''}
        </span>
      </span>
      {children}
      {onDownload && (
        <button type="button" className="icon-btn" onClick={onDownload} aria-label={`Download ${name}`}>
          <Icon name="download" size={16} />
        </button>
      )}
      {onRemove && (
        <button type="button" className="icon-btn" onClick={onRemove} aria-label={`Remove ${name}`}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  )
}

export const chipFor = (f) => ({ name: f.name, size: f.size })
