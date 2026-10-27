import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Shell } from '../components/Shell'
import { Timer } from '../components/Timer'
import { Progress } from '../components/Progress'
import { ErrorNote } from '../components/ErrorNote'
import { api, ApiError } from '../lib/api'
import { clearSession, loadSession } from '../lib/session'
import { PUBLIC_QUESTIONS } from '../data/questions'
import { QUESTION_TIME_MS, type AnswerVerdict, type PublicQuestion, type StartResponse } from '../lib/types'

type Phase = 'answering' | 'submitting' | 'revealed' | 'finishing'
const LETTERS = ['A', 'B', 'C', 'D']

export function Quiz() {
  const nav = useNavigate()
  const state = useLocation().state as StartResponse | null
  const session = loadSession()

  const questions: PublicQuestion[] = state?.questions ?? PUBLIC_QUESTIONS
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [selected, setSelected] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<AnswerVerdict | null>(null)
  const [deadline, setDeadline] = useState(() => Date.now() + QUESTION_TIME_MS)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<{ questionId: number; selected: number | null } | null>(null)

  useEffect(() => { if (!session) nav('/start', { replace: true }) }, [session, nav])

  const q = questions[idx]
  const isLast = idx === questions.length - 1

  const submit = useCallback(async (choice: number | null) => {
    if (!session || !q) return
    pendingRef.current = { questionId: q.id, selected: choice }
    setPhase('submitting'); setError(null)
    try {
      const v = await api.answer(session.attemptId, session.token, q.id, choice)
      setVerdict(v); setPhase('revealed')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'already_finished') { nav('/result', { replace: true }); return }
      setError(err instanceof ApiError ? err.message : 'Connection lost. Your answer was not scored yet.')
      setPhase('answering')
    }
  }, [session, q, nav])

  function choose(i: number) {
    if (phase !== 'answering') return
    setSelected(i); void submit(i)
  }
  const onExpire = useCallback(() => {
    if (phase === 'answering' && !pendingRef.current) { setSelected(null); void submit(null) }
  }, [phase, submit])

  function retry() {
    const p = pendingRef.current
    if (p) void submit(p.selected)
  }

  async function next() {
    if (isLast) {
      setPhase('finishing'); setError(null)
      try {
        const result = await api.finish(session!.attemptId, session!.token)
        clearSession()
        nav('/result', { state: result, replace: true })
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not submit the final report. Try again.')
        setPhase('revealed')
      }
      return
    }
    pendingRef.current = null
    setIdx((i) => i + 1); setSelected(null); setVerdict(null)
    setDeadline(Date.now() + QUESTION_TIME_MS); setPhase('answering')
  }

  if (!q) return null
  const running = phase === 'answering' && !pendingRef.current

  return (
    <Shell>
      <div className="flex items-center gap-5 mb-6">
        <div className="flex-1"><Progress current={idx + 1} total={questions.length} /></div>
        <Timer deadline={deadline} running={running} onExpire={onExpire} />
      </div>

      <AnimatePresence mode="wait">
        <motion.section key={q.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
          {q.image && (
            <figure className="mb-6 -mx-4 sm:mx-0 relative">
              <img src={q.image} alt="" className="w-full aspect-[16/9] object-cover" />
              <div className="absolute inset-0 vignette pointer-events-none" />
              {q.evidenceLabel && <span className="absolute top-3 left-3 label bg-navy-deep/80 px-2 py-1">{q.evidenceLabel}</span>}
              {q.imageCaption && <figcaption className="mt-2 px-4 sm:px-0 text-xs font-mono text-paper-dim">{q.imageCaption}</figcaption>}
            </figure>
          )}
          {!q.image && q.evidenceLabel && <p className="label mb-3">{q.evidenceLabel}</p>}

          <h1 className="text-2xl sm:text-3xl font-semibold leading-snug mb-6">{q.prompt}</h1>

          <div className="space-y-3">
            {q.options.map((opt, i) => {
              let cls = 'option'
              if (phase === 'revealed' && verdict) {
                if (i === verdict.correctIndex) cls += ' correct'
                else if (i === selected) cls += ' wrong'
              } else if (i === selected) cls += ' selected'
              return (
                <button key={i} className={cls} disabled={phase !== 'answering'} onClick={() => choose(i)}>
                  <span className="font-mono text-sand mr-4">{LETTERS[i]}</span>
                  <span className="text-lg">{opt}</span>
                </button>
              )
            })}
          </div>

          {phase === 'submitting' && <p className="mt-4 label animate-pulse">Verifying with headquarters…</p>}
          {error && <div className="mt-4"><ErrorNote message={error} onRetry={pendingRef.current ? retry : undefined} /></div>}

          {phase !== 'answering' && phase !== 'submitting' && verdict && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-6 border-l-2 pl-5 py-1 ${verdict.isCorrect ? 'border-teal-soft' : 'border-rust'}`}>
              <div className={`label mb-2 ${verdict.isCorrect ? 'text-teal-soft' : 'text-rust-soft'}`}>
                {verdict.expired ? 'Time expired · 0 points' : verdict.isCorrect ? `Correct · +${verdict.points} points` : 'Incorrect · 0 points'}
              </div>
              <p className="text-paper/85 leading-relaxed">{verdict.explanation}</p>
              <button className="btn btn-primary mt-5" onClick={next} disabled={phase === 'finishing'}>
                {phase === 'finishing' ? 'Filing report…' : isLast ? 'File final report' : 'Next evidence'}
              </button>
            </motion.div>
          )}
        </motion.section>
      </AnimatePresence>
    </Shell>
  )
}
