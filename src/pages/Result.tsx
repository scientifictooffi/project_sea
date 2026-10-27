import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shell } from '../components/Shell'
import { PUBLIC_QUESTIONS } from '../data/questions'
import type { FinalResult } from '../lib/types'

const RANK_NOTE: Record<FinalResult['rank'], string> = {
  'Chief Investigator': 'Flawless evidence handling. The case is closed.',
  'Senior Detective': 'Strong work. A few leads were left on the table.',
  'Field Agent': 'Solid instincts, but the files need another read.',
  'Trainee': 'The dust storm got to you. Review the evidence below.',
  'Lost in the Dust': 'The trail went cold. Study the case file and try again next time.',
}

export function Result() {
  const r = useLocation().state as FinalResult | null
  if (!r) {
    return (
      <Shell>
        <p className="label mb-3">No report found</p>
        <p className="text-paper/80 mb-6">This session has no completed investigation. Results are shown once, right after you finish.</p>
        <Link to="/board" className="btn btn-ghost">View leaderboard</Link>
      </Shell>
    )
  }
  const mins = Math.floor(r.durationMs / 60000), secs = Math.round((r.durationMs % 60000) / 1000)
  return (
    <Shell>
      <p className="label mb-3">Final report · {r.nickname}</p>
      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="display text-6xl sm:text-7xl text-sand mb-2">{r.rank}</motion.h1>
      <p className="text-paper/75 mb-8">{RANK_NOTE[r.rank]}</p>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-paper/10 border border-paper/10 mb-10">
        {[['Score', r.score], ['Correct', `${r.correctCount} / ${r.totalQuestions}`], ['Accuracy', `${r.accuracy}%`], ['Time', `${mins}:${String(secs).padStart(2, '0')}`]].map(([k, v]) => (
          <div key={String(k)} className="bg-navy-deep p-4">
            <dt className="label">{k}</dt>
            <dd className="font-mono text-3xl mt-1">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="label mb-4">Evidence review</h2>
      <ol className="space-y-6 mb-10">
        {r.review.map((v, i) => {
          const q = PUBLIC_QUESTIONS.find((x) => x.id === v.questionId)
          if (!q) return null
          return (
            <li key={v.questionId} className={`border-l-2 pl-5 ${v.isCorrect ? 'border-teal-soft' : 'border-rust'}`}>
              <p className="font-semibold mb-1">{i + 1}. {q.prompt}</p>
              <p className="text-sm text-paper-dim">
                Your answer: <span className={v.isCorrect ? 'text-teal-soft' : 'text-rust-soft'}>{v.selected === null ? (v.expired ? 'time expired' : 'none') : q.options[v.selected]}</span>
                {!v.isCorrect && <> · Correct: <span className="text-teal-soft">{q.options[v.correctIndex]}</span></>}
                {v.isCorrect && <> · +{v.points}</>}
              </p>
              <p className="mt-2 text-paper/80 text-sm leading-relaxed">{v.explanation}</p>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap gap-4">
        <Link to="/board" className="btn btn-primary">See the leaderboard</Link>
        <Link to="/" className="btn btn-ghost">Home</Link>
      </div>
    </Shell>
  )
}
