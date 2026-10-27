import { MOCK_MODE, supabase } from './supabase'
import { PUBLIC_QUESTIONS } from '../data/questions'
import {
  POINTS_CORRECT, POINTS_SPEED_BONUS_MAX, QUESTION_TIME_MS, rankFor,
  type AdminStats, type AnswerVerdict, type FinalResult, type LeaderboardRow, type StartResponse,
} from './types'

export class ApiError extends Error {
  code: string
  constructor(message: string, code: string = 'unknown') { super(message); this.code = code }
}

export interface QuizApi {
  start(nickname: string): Promise<StartResponse>
  answer(attemptId: string, token: string, questionId: number, selected: number | null): Promise<AnswerVerdict>
  finish(attemptId: string, token: string): Promise<FinalResult>
  leaderboard(limit?: number): Promise<LeaderboardRow[]>
  subscribeLeaderboard(onChange: () => void): () => void
  adminStats(password: string): Promise<AdminStats>
  adminReset(password: string): Promise<{ deleted: number }>
}

/* ------------------------------------------------------------------ */
/* Real implementation: Supabase Edge Function "quiz" + leaderboard view */
/* ------------------------------------------------------------------ */

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new ApiError('Supabase is not configured', 'config')
  const { data, error } = await supabase.functions.invoke('quiz', { body })
  if (error) {
    // Edge function returned non-2xx: try to read its JSON error body
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json()
        throw new ApiError(j.error ?? error.message, j.code ?? 'server')
      } catch (e) { if (e instanceof ApiError) throw e }
    }
    throw new ApiError(error.message || 'Network error', 'network')
  }
  if (data && data.error) throw new ApiError(data.error, data.code ?? 'server')
  return data as T
}

const realApi: QuizApi = {
  start: (nickname) => invoke({ action: 'start', nickname }),
  answer: (attemptId, token, questionId, selected) =>
    invoke({ action: 'answer', attemptId, token, questionId, selected }),
  finish: (attemptId, token) => invoke({ action: 'finish', attemptId, token }),
  async leaderboard(limit = 100) {
    const { data, error } = await supabase!
      .from('leaderboard')
      .select('id,nickname,score,correct_count,duration_ms,created_at')
      .order('score', { ascending: false })
      .order('duration_ms', { ascending: true })
      .limit(limit)
    if (error) throw new ApiError(error.message, 'db')
    return data as LeaderboardRow[]
  },
  subscribeLeaderboard(onChange) {
    const channel = supabase!
      .channel('results-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, onChange)
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  },
  adminStats: (password) => invoke({ action: 'admin_stats', password }),
  adminReset: (password) => invoke({ action: 'admin_reset', password, confirm: 'RESET' }),
}

/* ------------------------------------------------------------------ */
/* Mock implementation: in-memory, for local development without a DB  */
/* The answer key here is ONLY for the mock. Production keeps it in DB. */
/* ------------------------------------------------------------------ */

const MOCK_KEY: Record<number, { correct: number; explanation: string }> = {
  1: { correct: 1, explanation: 'From the 1960s the Amu Darya and Syr Darya were diverted to irrigate cotton and rice fields, cutting the inflow that kept the sea alive.' },
  2: { correct: 0, explanation: 'Satellite records from 1960 to today show the sea losing roughly 90% of its surface area and splitting into separate basins.' },
  3: { correct: 1, explanation: 'Ports such as Aralsk and Moynaq lost their fishing fleets; tens of thousands of jobs disappeared with the water.' },
  4: { correct: 2, explanation: 'The Kok-Aral Dam, completed in 2005 with World Bank support, raised the North Aral Sea level and brought fish back.' },
  5: { correct: 2, explanation: 'Verified data gives credibility, documentary images give evidence, and interactive storytelling keeps the audience engaged.' },
}

interface MockAttempt {
  id: string; token: string; nickname: string; startedAt: number
  currentIndex: number; servedAt: number; answers: AnswerVerdict[]; finished?: FinalResult
}
const mockAttempts = new Map<string, MockAttempt>()
const mockResults: LeaderboardRow[] = []
const mockListeners = new Set<() => void>()
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function scoreFor(isCorrect: boolean, elapsedMs: number) {
  if (!isCorrect) return 0
  const remaining = Math.max(0, QUESTION_TIME_MS - elapsedMs)
  return POINTS_CORRECT + Math.round((remaining / QUESTION_TIME_MS) * POINTS_SPEED_BONUS_MAX)
}

const mockApi: QuizApi = {
  async start(nickname) {
    await delay(300)
    const now = Date.now()
    const a: MockAttempt = { id: rid(), token: rid(), nickname, startedAt: now, currentIndex: 0, servedAt: now, answers: [] }
    mockAttempts.set(a.id, a)
    return { attemptId: a.id, token: a.token, nickname, questions: PUBLIC_QUESTIONS, servedAt: now, serverNow: now }
  },
  async answer(attemptId, token, questionId, selected) {
    await delay(250)
    const a = mockAttempts.get(attemptId)
    if (!a || a.token !== token) throw new ApiError('Attempt not found', 'not_found')
    if (a.finished) throw new ApiError('Attempt already completed', 'already_finished')
    const existing = a.answers.find((v) => v.questionId === questionId)
    if (existing) return existing // idempotent: a retried request never re-scores
    const q = PUBLIC_QUESTIONS[a.currentIndex]
    if (!q || q.id !== questionId) throw new ApiError('Questions must be answered in order', 'out_of_order')
    const now = Date.now()
    const elapsed = now - a.servedAt
    const expired = elapsed > QUESTION_TIME_MS + 2500
    const key = MOCK_KEY[questionId]
    const isCorrect = !expired && selected === key.correct
    const verdict: AnswerVerdict = {
      questionId, selected: expired ? null : selected, correctIndex: key.correct, isCorrect,
      points: scoreFor(isCorrect, elapsed), explanation: key.explanation, expired,
      nextServedAt: a.currentIndex + 1 < PUBLIC_QUESTIONS.length ? now : null,
    }
    a.answers.push(verdict); a.currentIndex += 1; a.servedAt = now
    return verdict
  },
  async finish(attemptId, token) {
    await delay(300)
    const a = mockAttempts.get(attemptId)
    if (!a || a.token !== token) throw new ApiError('Attempt not found', 'not_found')
    if (a.finished) return a.finished
    if (a.answers.length < PUBLIC_QUESTIONS.length) throw new ApiError('Not all questions answered', 'incomplete')
    const score = a.answers.reduce((s, v) => s + v.points, 0)
    const correctCount = a.answers.filter((v) => v.isCorrect).length
    const durationMs = Date.now() - a.startedAt
    const result: FinalResult = {
      attemptId, nickname: a.nickname, score, correctCount, totalQuestions: PUBLIC_QUESTIONS.length,
      accuracy: Math.round((correctCount / PUBLIC_QUESTIONS.length) * 100), durationMs,
      rank: rankFor(score, PUBLIC_QUESTIONS.length), review: a.answers,
    }
    a.finished = result
    mockResults.push({ id: attemptId, nickname: a.nickname, score, correct_count: correctCount, duration_ms: durationMs, created_at: new Date().toISOString() })
    mockListeners.forEach((l) => l())
    return result
  },
  async leaderboard(limit = 100) {
    return [...mockResults].sort((x, y) => y.score - x.score || x.duration_ms - y.duration_ms).slice(0, limit)
  },
  subscribeLeaderboard(onChange) { mockListeners.add(onChange); return () => mockListeners.delete(onChange) },
  async adminStats(password) {
    if (password !== 'admin') throw new ApiError('Wrong password', 'unauthorized')
    const completed = [...mockAttempts.values()].filter((a) => a.finished)
    const perQ = PUBLIC_QUESTIONS.map((q) => ({
      questionId: q.id, prompt: q.prompt,
      correctRate: completed.length ? Math.round((completed.filter((a) => a.answers.find((v) => v.questionId === q.id)?.isCorrect).length / completed.length) * 100) : 0,
    }))
    return {
      totalAttempts: mockAttempts.size, completedAttempts: completed.length,
      averageScore: completed.length ? Math.round(completed.reduce((s, a) => s + a.finished!.score, 0) / completed.length) : 0,
      averageAccuracy: completed.length ? Math.round(completed.reduce((s, a) => s + a.finished!.accuracy, 0) / completed.length) : 0,
      perQuestionAccuracy: perQ, recent: await mockApi.leaderboard(20),
    }
  },
  async adminReset(password) {
    if (password !== 'admin') throw new ApiError('Wrong password', 'unauthorized')
    const n = mockResults.length
    mockResults.length = 0; mockAttempts.clear(); mockListeners.forEach((l) => l())
    return { deleted: n }
  },
}

export const api: QuizApi = MOCK_MODE ? mockApi : realApi
