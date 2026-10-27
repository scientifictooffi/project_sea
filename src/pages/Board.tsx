import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QrBadge } from '../components/QrBadge'
import { api } from '../lib/api'
import type { LeaderboardRow } from '../lib/types'

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`

/** Projector view. Realtime subscription + 15 s polling as a safety net. */
export function Board() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [status, setStatus] = useState<'live' | 'offline'>('live')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try { setRows(await api.leaderboard(50)); setStatus('live'); setUpdatedAt(new Date()) }
    catch { setStatus('offline') }
  }, [])

  useEffect(() => {
    void load()
    const unsub = api.subscribeLeaderboard(() => { void load() })
    const id = window.setInterval(() => { void load() }, 15000)
    return () => { unsub(); window.clearInterval(id) }
  }, [load])

  return (
    <div className="grain min-h-dvh relative flex flex-col">
      <div className="absolute inset-0 -z-10">
        <img src="/images/seabed.jpg" alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy-deep/90 to-navy-deep/70" />
      </div>

      <header className="px-6 lg:px-12 pt-8 pb-4 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label mb-2">Live case board · {rows.length} detectives</p>
          <h1 className="display text-5xl lg:text-7xl">The Case of the <span className="text-sand">Disappearing Sea</span></h1>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-paper-dim">
          <span className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-teal-soft animate-pulse' : 'bg-rust'}`} />
          {status === 'live' ? 'Receiving reports' : 'Connection lost · retrying'}
          {updatedAt && <span>· {updatedAt.toLocaleTimeString()}</span>}
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_auto] gap-10 px-6 lg:px-12 pb-10">
        <section>
          <div className="grid grid-cols-[3rem_1fr_6rem_5rem_6rem] gap-3 label pb-3 border-b border-paper/15">
            <span>#</span><span>Detective</span><span className="text-right">Score</span><span className="text-right">Correct</span><span className="text-right">Time</span>
          </div>
          {rows.length === 0 && <p className="py-12 text-paper-dim text-xl">Waiting for the first report. Scan the code to join.</p>}
          <ol>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.li key={r.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
                  className={`grid grid-cols-[3rem_1fr_6rem_5rem_6rem] gap-3 items-center py-3 border-b border-paper/10 text-xl lg:text-2xl ${i < 3 ? 'text-paper' : 'text-paper/80'}`}>
                  <span className={`font-mono ${i === 0 ? 'text-sand' : i < 3 ? 'text-teal-soft' : 'text-paper-dim'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="truncate font-semibold">{r.nickname}</span>
                  <span className="font-mono text-right">{r.score}</span>
                  <span className="font-mono text-right text-paper-dim">{r.correct_count}/5</span>
                  <span className="font-mono text-right text-paper-dim">{fmt(r.duration_ms)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </section>
        <aside className="lg:sticky lg:top-8 self-start flex flex-col items-center gap-4 lg:pt-6">
          <p className="label">Scan to join</p>
          <QrBadge size={220} />
        </aside>
      </main>
    </div>
  )
}
