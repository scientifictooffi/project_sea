import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MOCK_MODE } from '../lib/supabase'

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grain min-h-dvh flex flex-col">
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-paper/10">
        <Link to="/" className="label hover:text-paper transition-colors">Case file · Aral Sea</Link>
        {MOCK_MODE && (
          <span className="label text-rust-soft" title="No Supabase config found. Data lives in memory only.">
            Mock mode
          </span>
        )}
      </header>
      <main className={`flex-1 w-full mx-auto px-4 sm:px-8 py-8 ${wide ? 'max-w-7xl' : 'max-w-2xl'}`}>
        {children}
      </main>
      <footer className="px-4 sm:px-8 py-4 text-paper-dim text-xs font-mono border-t border-paper/10 flex flex-wrap gap-x-6 gap-y-1 justify-between">
        <span>Images: NASA, ESA, A. Zwegers (CC BY 2.0), Aliyaassubayeva (CC BY-SA 4.0), Staecker (PD).</span>
        <Link to="/board" className="hover:text-sand">Leaderboard</Link>
      </footer>
    </div>
  )
}
