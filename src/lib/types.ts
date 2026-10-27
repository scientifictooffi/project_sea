export interface PublicQuestion {
  id: number
  order: number
  prompt: string
  options: string[]
  image?: string
  imageCaption?: string
  evidenceLabel?: string
}

export interface AnswerVerdict {
  questionId: number
  selected: number | null
  correctIndex: number
  isCorrect: boolean
  points: number
  explanation: string
  expired: boolean
  /** Server timestamp (ms) when the next question was served; null when quiz ended */
  nextServedAt: number | null
}

export interface StartResponse {
  attemptId: string
  token: string
  nickname: string
  questions: PublicQuestion[]
  servedAt: number
  serverNow: number
}

export interface FinalResult {
  attemptId: string
  nickname: string
  score: number
  correctCount: number
  totalQuestions: number
  accuracy: number
  durationMs: number
  rank: DetectiveRank
  review: AnswerVerdict[]
}

export type DetectiveRank = 'Chief Investigator' | 'Senior Detective' | 'Field Agent' | 'Trainee' | 'Lost in the Dust'

export interface LeaderboardRow {
  id: string
  nickname: string
  score: number
  correct_count: number
  duration_ms: number
  created_at: string
}

export interface AdminStats {
  totalAttempts: number
  completedAttempts: number
  averageScore: number
  averageAccuracy: number
  perQuestionAccuracy: { questionId: number; prompt: string; correctRate: number }[]
  recent: LeaderboardRow[]
}

export const QUESTION_TIME_MS = 20_000
export const POINTS_CORRECT = 100
export const POINTS_SPEED_BONUS_MAX = 100

export function rankFor(score: number, total: number): DetectiveRank {
  const max = total * (POINTS_CORRECT + POINTS_SPEED_BONUS_MAX)
  const r = score / max
  if (r >= 0.85) return 'Chief Investigator'
  if (r >= 0.65) return 'Senior Detective'
  if (r >= 0.45) return 'Field Agent'
  if (r >= 0.2) return 'Trainee'
  return 'Lost in the Dust'
}
