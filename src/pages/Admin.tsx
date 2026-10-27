import { useState, type FormEvent } from 'react'
import { Shell } from '../components/Shell'
import { ErrorNote } from '../components/ErrorNote'
import { api, ApiError } from '../lib/api'
import type { AdminStats } from '../lib/types'

/** The password is never stored in the bundle: it is sent to the Edge
 *  Function, which compares it with the ADMIN_PASSWORD secret. */
export function Admin() {
  const [pw, setPw] = useState('')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try { setStats(await api.adminStats(pw)) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Network error') }
    finally { setBusy(false) }
  }
  async function reset() {
    if (confirmText !== 'RESET') return
    if (!window.confirm('Delete ALL attempts and results? This cannot be undone.')) return
    setBusy(true); setError(null)
    try {
      const { deleted } = await api.adminReset(pw)
      setNotice(`Deleted ${deleted} results.`); setConfirmText('')
      setStats(await api.adminStats(pw))
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Network error') }
    finally { setBusy(false) }
  }

  if (!stats) {
    return (
      <Shell>
        <p className="label mb-3">Restricted</p>
        <h1 className="display text-5xl mb-6">Organizer access</h1>
        <form onSubmit={login} className="space-y-4">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Admin password" autoFocus
            className="w-full bg-navy border border-paper/20 focus:border-sand outline-none px-4 py-3 font-mono" />
          {error && <ErrorNote message={error} />}
          <button className="btn btn-primary" disabled={busy || !pw}>Unlock</button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell wide>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div><p className="label mb-2">Organizer dashboard</p><h1 className="display text-5xl">Case statistics</h1></div>
        <button className="btn btn-ghost py-2 text-xs" onClick={() => void api.adminStats(pw).then(setStats)}>Refresh</button>
      </div>
      {notice && <p className="mb-4 text-teal-soft font-mono text-sm">{notice}</p>}
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-paper/10 border border-paper/10 mb-10">
        {[['Started', stats.totalAttempts], ['Completed', stats.completedAttempts], ['Avg score', stats.averageScore], ['Avg accuracy', `${stats.averageAccuracy}%`]].map(([k, v]) => (
          <div key={String(k)} className="bg-navy-deep p-4"><dt className="label">{k}</dt><dd className="font-mono text-3xl mt-1">{v}</dd></div>
        ))}
      </dl>

      <h2 className="label mb-3">Accuracy per question</h2>
      <ul className="space-y-3 mb-10">
        {stats.perQuestionAccuracy.map((q) => (
          <li key={q.questionId}>
            <div className="flex justify-between text-sm mb-1"><span className="text-paper/85">{q.questionId}. {q.prompt}</span><span className="font-mono text-sand">{q.correctRate}%</span></div>
            <div className="h-1.5 bg-paper/10"><div className="h-full bg-teal" style={{ width: `${q.correctRate}%` }} /></div>
          </li>
        ))}
      </ul>

      <h2 className="label mb-3">Latest completed attempts</h2>
      <table className="w-full text-sm font-mono mb-12">
        <thead className="text-paper-dim text-left"><tr><th className="py-2">Nickname</th><th>Score</th><th>Correct</th><th>Time</th><th>Finished</th></tr></thead>
        <tbody>
          {stats.recent.map((r) => (
            <tr key={r.id} className="border-t border-paper/10"><td className="py-2">{r.nickname}</td><td>{r.score}</td><td>{r.correct_count}</td><td>{Math.round(r.duration_ms / 1000)}s</td><td>{new Date(r.created_at).toLocaleTimeString()}</td></tr>
          ))}
        </tbody>
      </table>

      <section className="border border-rust/50 p-5">
        <h2 className="label text-rust-soft mb-2">Danger zone</h2>
        <p className="text-paper/80 text-sm mb-4">Deletes every attempt and result. Type <span className="font-mono text-sand">RESET</span> to enable the button.</p>
        <div className="flex flex-wrap gap-3">
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET" className="bg-navy border border-paper/20 px-3 py-2 font-mono" />
          <button className="btn btn-primary py-2 text-xs" disabled={confirmText !== 'RESET' || busy} onClick={reset}>Reset all results</button>
        </div>
      </section>
    </Shell>
  )
}
