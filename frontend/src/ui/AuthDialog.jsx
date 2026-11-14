import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import { Icon } from '../icons'

const initialOf = (user) => (user.name || user.email || '?')[0].toUpperCase()

/**
 * Sign in / create an account when signed out; account details and sign out when signed in.
 * Accounts are optional: the app works without one, and signing in keeps your data across devices.
 */
export function AuthDialog({ user, onClose, onAuthed, onSignOut, notify }) {
  const dialog = useRef(null)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [fields, setFields] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const set = (key) => (e) => {
    setFields((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const switchTo = (next) => {
    setMode(next)
    setErrors({})
    setFormError('')
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErrors({})
    setFormError('')
    try {
      const signUp = mode === 'signup'
      const { user: signedIn } = signUp
        ? await api.register(fields)
        : await api.login({ email: fields.email, password: fields.password })
      onAuthed(signedIn, signUp)
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors)
      else setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    try {
      await api.downloadMyData()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not download your data', 'error')
    }
  }

  const field = (key, label, props) => (
    <div className={`field${errors[key] ? ' has-error' : ''}`}>
      <div className="field-label">
        <label htmlFor={`auth-${key}`}>{label}</label>
      </div>
      <input id={`auth-${key}`} value={fields[key]} onChange={set(key)} aria-invalid={!!errors[key]} disabled={busy} {...props} />
      {errors[key] && (
        <p className="field-error">
          <Icon name="warn" size={14} /> {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <dialog
      ref={dialog}
      className="modal auth-modal"
      aria-labelledby="auth-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
    >
      <div className="auth-body">
        <header className="modal-head">
          <span className="modal-icon">
            <Icon name="user" size={20} />
          </span>
          <div>
            <h2 id="auth-title">{user ? 'Your account' : mode === 'signup' ? 'Create an account' : 'Sign in'}</h2>
            <p>
              {user
                ? 'Your applications are saved to this account and follow you to any browser.'
                : 'Optional. Sign in to keep your data across devices. Without an account, it stays in this browser.'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </header>

        {user ? (
          <div className="account-view">
            <div className="account-card">
              <span className="avatar big">{initialOf(user)}</span>
              <div>
                <strong>{user.name || 'Signed in'}</strong>
                <span className="muted">{user.email}</span>
              </div>
            </div>
            <ul className="stored-list">
              <li>
                Stored in the database: your email{user.name ? ', name' : ''}, a scrambled (hashed) password and your
                applications.
              </li>
              <li>Never stored: your password itself, or your session cookie (only a hash of it).</li>
            </ul>
            <div className="modal-buttons account-actions">
              <button type="button" className="btn ghost" onClick={() => void download()}>
                <Icon name="download" size={16} /> Download my data
              </button>
              <button type="button" className="btn primary" onClick={onSignOut}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account">
              <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => switchTo('signin')}>
                Sign in
              </button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchTo('signup')}>
                Create account
              </button>
            </div>

            {mode === 'signup' &&
              field('name', 'Name (optional)', { maxLength: 60, autoComplete: 'name', placeholder: 'Your name' })}
            {field('email', 'Email', {
              type: 'email',
              maxLength: 254,
              autoComplete: 'email',
              placeholder: 'you@example.com',
              autoFocus: true,
            })}
            {field('password', 'Password', {
              type: 'password',
              maxLength: 128,
              autoComplete: mode === 'signup' ? 'new-password' : 'current-password',
              placeholder: mode === 'signup' ? 'At least 8 characters' : 'Your password',
            })}

            {formError && (
              <p className="form-error" role="alert">
                <Icon name="alert" size={16} /> {formError}
              </p>
            )}

            <button type="submit" className="btn primary auth-submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              <Icon name="arrow" size={16} />
            </button>
            <p className="field-hint auth-note">
              <Icon name="lock" size={12} /> Passwords are hashed before they are stored. Nothing is sent to third parties.
            </p>
          </form>
        )}
      </div>
    </dialog>
  )
}
