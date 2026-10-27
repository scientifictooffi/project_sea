import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrBadge } from '../components/QrBadge'

export function Landing() {
  return (
    <div className="grain min-h-dvh relative flex flex-col">
      <div className="absolute inset-0 -z-10">
        <img src="/images/ships.jpg" alt="" className="w-full h-full object-cover object-[60%_center]" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/70 to-navy-deep/30" />
        <div className="absolute inset-0 vignette" />
      </div>

      <header className="px-5 sm:px-10 py-5 flex justify-between items-center">
        <span className="label">Case file № 1960</span>
        <Link to="/board" className="label hover:text-paper">Leaderboard →</Link>
      </header>

      <main className="flex-1 flex flex-col justify-end px-5 sm:px-10 pb-10 sm:pb-16 max-w-5xl w-full">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1 }} className="label mb-4">
          Environmental investigation · Kazakhstan
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1 }}
          className="display text-[clamp(3.2rem,11vw,8.5rem)] text-paper">
          The Case of the<br /><span className="text-sand">Disappearing Sea</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }}
          className="mt-6 max-w-xl text-lg text-paper/85 leading-relaxed">
          In 1960 the Aral Sea was the fourth-largest lake on Earth. Within one lifetime it was gone.
          Examine the evidence, answer five questions against the clock, and earn your detective rank.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.8 }}
          className="mt-8 flex flex-col sm:flex-row sm:items-end gap-8">
          <Link to="/start" className="btn btn-primary text-base">Start Investigation</Link>
          <div className="hidden sm:block"><QrBadge size={96} /></div>
        </motion.div>
      </main>
    </div>
  )
}
