import { useEffect, useState } from 'react'
import { QUESTION_TIME_MS } from '../lib/types'

/** Countdown ring. `deadline` is an absolute client timestamp (ms). */
export function Timer({ deadline, running, onExpire }: { deadline: number; running: boolean; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()))

  useEffect(() => {
    if (!running) return
    let fired = false
    const tick = () => {
      const l = Math.max(0, deadline - Date.now())
      setLeft(l)
      if (l === 0 && !fired) { fired = true; onExpire() }
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [deadline, running, onExpire])

  const seconds = Math.ceil(left / 1000)
  const pct = left / QUESTION_TIME_MS
  const r = 26, c = 2 * Math.PI * r
  const urgent = seconds <= 5 && running
  return (
    <div className="relative w-16 h-16 shrink-0" aria-live="polite" aria-label={`${seconds} seconds left`}>
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(242,238,230,0.12)" strokeWidth="3" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={urgent ? '#d4703f' : '#5a9a97'} strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms' }} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-mono text-lg ${urgent ? 'text-rust-soft' : 'text-paper'}`}>
        {seconds}
      </span>
    </div>
  )
}
