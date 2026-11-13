// Resume vault. Files live in this browser's IndexedDB and are NEVER sent to the server:
// no upload endpoint, no accounts, nothing to leak. One file per resume version label.

import { useCallback, useEffect, useState } from 'react'

export const RESUME_MAX_BYTES = 2 * 1024 * 1024
export const RESUME_ACCEPT = '.pdf,.doc,.docx'

const DB_NAME = 'nextup-resumes'
const STORE = 'files'
const CHANGED = 'nextup:resumes'

export interface ResumeFile {
  version: string
  name: string
  size: number
  addedAt: number
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Resume storage is not available in this browser mode'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'version' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open resume storage'))
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = work(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('Resume storage failed'))
    })
  } finally {
    db.close()
  }
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b)

/** Returns an error message, or null when the file is an acceptable resume. */
export async function validateResume(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['pdf', 'doc', 'docx'].includes(ext)) return 'Use a PDF, DOC or DOCX file'
  if (file.size === 0) return 'That file is empty'
  if (file.size > RESUME_MAX_BYTES) return 'Keep resumes under 2 MB'
  // Check the real file signature, not just the name.
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const ok =
    (ext === 'pdf' && startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) || // %PDF-
    (ext === 'docx' && startsWith(head, [0x50, 0x4b, 0x03, 0x04])) || // zip container
    (ext === 'doc' && startsWith(head, [0xd0, 0xcf, 0x11, 0xe0])) // legacy OLE
  return ok ? null : `That doesn't look like a real .${ext} file`
}

const cleanName = (name: string) => name.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '').trim().slice(0, 80) || 'resume'

export async function putResume(version: string, file: File): Promise<void> {
  const problem = await validateResume(file)
  if (problem) throw new Error(problem)
  const record: ResumeFile = { version, name: cleanName(file.name), size: file.size, addedAt: Date.now(), blob: file }
  await run('readwrite', (s) => s.put(record))
  window.dispatchEvent(new Event(CHANGED))
}

export async function deleteResume(version: string): Promise<void> {
  await run('readwrite', (s) => s.delete(version))
  window.dispatchEvent(new Event(CHANGED))
}

export const listResumes = () => run<ResumeFile[]>('readonly', (s) => s.getAll())

/** Saves the file through the browser's normal download flow. It is never opened or rendered. */
export function downloadResume(file: ResumeFile) {
  const url = URL.createObjectURL(file.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

/** All stored resumes, kept in sync across the form and the Resume Lab. */
export function useResumes() {
  const [files, setFiles] = useState<ResumeFile[]>([])
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    listResumes().then(
      (all) => {
        setFiles(all)
        setError('')
      },
      (e: unknown) => setError(e instanceof Error ? e.message : 'Resume storage failed'),
    )
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener(CHANGED, refresh)
    return () => window.removeEventListener(CHANGED, refresh)
  }, [refresh])

  return { files, error }
}
