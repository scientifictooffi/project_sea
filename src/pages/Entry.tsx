import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { ErrorNote } from '../components/ErrorNote'
import { api, ApiError } from '../lib/api'
import { saveSession } from '../lib/session'

const NICK_RE = /^[\p{L}\p{N} _.-]{2,20}$/u

export function Entry() {
  const nav = useNavigate()
  const [nick, setNick] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = nick.trim()
  const valid = NICK_RE.test(trimmed)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true); setError(null)
    try {
      const res = await api.start(trimmed)
      saveSession({ attemptId: res.attemptId, token: res.token, nickname: res.nickname })
      nav('/quiz', { state: res, replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <p className="label mb-3">Step 1 of 3 · Identify yourself</p>
      <h1 className="display text-5xl sm:text-6xl mb-6">Detective registration</h1>
      <p className="text-paper/80 mb-8 leading-relaxed">
        Choose a nickname for the public leaderboard. No account, no email. Use 2 to 20 letters, numbers, spaces,
        dots, dashes or underscores. Each investigation is scored once and cannot be repeated from the same session.
      </p>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="label">Nickname</span>
          <input autoFocus value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} autoComplete="off"
            className="mt-2 w-full bg-navy border border-paper/20 focus:border-sand outline-none px-4 py-4 text-xl font-mono text-paper placeholder:text-paper/30"
            placeholder="e.g. Agent Aral" />
          {trimmed.length > 0 && !valid && (
            <span className="block mt-2 text-sm text-rust-soft">Nickname must be 2 to 20 characters without special symbols.</span>
          )}
        </label>
        {error && <ErrorNote message={error} />}
        <button type="submit" disabled={!valid || busy} className="btn btn-primary w-full sm:w-auto">
          {busy ? 'Opening case file…' : 'Begin investigation'}
        </button>
      </form>
    </Shell>
  )
}
