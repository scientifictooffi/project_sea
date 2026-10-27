// Supabase Edge Function: all scoring happens here with the service-role key.
// Deploy: supabase functions deploy quiz --no-verify-jwt
// Secrets: supabase secrets set ADMIN_PASSWORD=...
import { createClient } from '@supabase/supabase-js'

const QUESTION_TIME_MS = 20_000
const GRACE_MS = 2_500            // network latency allowance
const POINTS_CORRECT = 100
const POINTS_SPEED_BONUS_MAX = 100
const TOTAL_QUESTIONS = 5
const NICK_RE = /^[\p{L}\p{N} _.-]{2,20}$/u

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const fail = (error: string, code: string, status = 400) => json({ error, code }, status)

function rankFor(score: number) {
  const r = score / (TOTAL_QUESTIONS * (POINTS_CORRECT + POINTS_SPEED_BONUS_MAX))
  if (r >= 0.85) return 'Chief Investigator'
  if (r >= 0.65) return 'Senior Detective'
  if (r >= 0.45) return 'Field Agent'
  if (r >= 0.2) return 'Trainee'
  return 'Lost in the Dust'
}

async function loadAttempt(attemptId: string, token: string) {
  if (!attemptId || !token) return null
  const { data } = await db.from('attempts').select('*').eq('id', attemptId).eq('token', token).maybeSingle()
  return data
}

async function publicQuestions() {
  const { data, error } = await db.from('questions').select('*').order('order')
  if (error) throw error
  return data.map((q) => ({
    id: q.id, order: q.order, prompt: q.prompt, options: q.options,
    image: q.image ?? undefined, imageCaption: q.image_caption ?? undefined, evidenceLabel: q.evidence_label ?? undefined,
  }))
}

// ---------------------------------------------------------------- actions

async function start(body: { nickname?: string }) {
  const nickname = String(body.nickname ?? '').trim()
  if (!NICK_RE.test(nickname)) return fail('Nickname must be 2 to 20 characters without special symbols.', 'invalid_nickname')
  const { data: a, error } = await db.from('attempts').insert({ nickname }).select('id, token, started_at').single()
  if (error) return fail('Could not create attempt', 'db', 500)
  const now = Date.now()
  return json({ attemptId: a.id, token: a.token, nickname, questions: await publicQuestions(), servedAt: now, serverNow: now })
}

async function answer(body: { attemptId?: string; token?: string; questionId?: number; selected?: number | null }) {
  const a = await loadAttempt(String(body.attemptId ?? ''), String(body.token ?? ''))
  if (!a) return fail('Attempt not found', 'not_found', 404)
  if (a.status === 'completed') return fail('This investigation is already filed.', 'already_finished', 409)

  const questionId = Number(body.questionId)
  const selected = body.selected === null || body.selected === undefined ? null : Number(body.selected)
  if (!Number.isInteger(questionId)) return fail('Bad question id', 'bad_request')
  if (selected !== null && !(Number.isInteger(selected) && selected >= 0 && selected <= 3)) return fail('Bad option', 'bad_request')

  // Idempotent: a retried request returns the stored verdict, never re-scores.
  const { data: existing } = await db.from('attempt_answers').select('*').eq('attempt_id', a.id).eq('question_id', questionId).maybeSingle()
  const { data: key } = await db.from('answer_keys').select('*').eq('question_id', questionId).single()
  if (!key) return fail('Unknown question', 'bad_request')

  if (existing) {
    return json({
      questionId, selected: existing.selected, correctIndex: key.correct_index, isCorrect: existing.is_correct,
      points: existing.points, explanation: key.explanation, expired: existing.expired,
      nextServedAt: a.current_question > TOTAL_QUESTIONS ? null : new Date(a.current_served_at).getTime(),
    })
  }
  if (questionId !== a.current_question) return fail('Questions must be answered in order', 'out_of_order', 409)

  const elapsed = Date.now() - new Date(a.current_served_at).getTime()
  const expired = elapsed > QUESTION_TIME_MS + GRACE_MS
  const effectiveSelected = expired ? null : selected
  const isCorrect = !expired && effectiveSelected === key.correct_index
  const remaining = Math.max(0, QUESTION_TIME_MS - elapsed)
  const points = isCorrect ? POINTS_CORRECT + Math.round((remaining / QUESTION_TIME_MS) * POINTS_SPEED_BONUS_MAX) : 0

  const { error: insErr } = await db.from('attempt_answers').insert({
    attempt_id: a.id, question_id: questionId, selected: effectiveSelected, is_correct: isCorrect, points, expired,
  })
  if (insErr) {
    // Unique violation = concurrent duplicate; re-read and return it.
    if (insErr.code === '23505') return answer(body)
    return fail('Could not record answer', 'db', 500)
  }
  const nextQ = a.current_question + 1
  const nowIso = new Date().toISOString()
  await db.from('attempts').update({ current_question: nextQ, current_served_at: nowIso }).eq('id', a.id)

  return json({
    questionId, selected: effectiveSelected, correctIndex: key.correct_index, isCorrect, points,
    explanation: key.explanation, expired, nextServedAt: nextQ > TOTAL_QUESTIONS ? null : Date.parse(nowIso),
  })
}

async function finish(body: { attemptId?: string; token?: string }) {
  const a = await loadAttempt(String(body.attemptId ?? ''), String(body.token ?? ''))
  if (!a) return fail('Attempt not found', 'not_found', 404)

  const { data: answers } = await db.from('attempt_answers').select('*').eq('attempt_id', a.id).order('question_id')
  if (!answers || answers.length < TOTAL_QUESTIONS) return fail('Not all questions have been answered.', 'incomplete', 409)
  const { data: keys } = await db.from('answer_keys').select('*')
  const keyMap = new Map((keys ?? []).map((k) => [k.question_id, k]))

  const score = answers.reduce((s, v) => s + v.points, 0)
  const correctCount = answers.filter((v) => v.is_correct).length
  const lastAnswer = Math.max(...answers.map((v) => new Date(v.answered_at).getTime()))
  const durationMs = Math.max(0, lastAnswer - new Date(a.started_at).getTime())

  // Insert once. The unique index on attempt_id makes a second finish a no-op.
  const { data: existing } = await db.from('results').select('*').eq('attempt_id', a.id).maybeSingle()
  let result = existing
  if (!result) {
    const { data: inserted, error } = await db.from('results')
      .insert({ attempt_id: a.id, nickname: a.nickname, score, correct_count: correctCount, duration_ms: durationMs })
      .select('*').single()
    if (error && error.code !== '23505') return fail('Could not save result', 'db', 500)
    result = inserted ?? (await db.from('results').select('*').eq('attempt_id', a.id).single()).data
    await db.from('attempts').update({ status: 'completed' }).eq('id', a.id)
  }

  return json({
    attemptId: a.id, nickname: a.nickname, score: result.score, correctCount: result.correct_count,
    totalQuestions: TOTAL_QUESTIONS, accuracy: Math.round((result.correct_count / TOTAL_QUESTIONS) * 100),
    durationMs: result.duration_ms, rank: rankFor(result.score),
    review: answers.map((v) => {
      const k = keyMap.get(v.question_id)!
      return { questionId: v.question_id, selected: v.selected, correctIndex: k.correct_index, isCorrect: v.is_correct,
        points: v.points, explanation: k.explanation, expired: v.expired, nextServedAt: null }
    }),
  })
}

function checkAdmin(password: unknown) {
  const expected = Deno.env.get('ADMIN_PASSWORD')
  if (!expected) return fail('ADMIN_PASSWORD secret is not set on the server.', 'config', 500)
  if (typeof password !== 'string' || password.length !== expected.length) return fail('Wrong password', 'unauthorized', 401)
  // Constant-time compare
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= password.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0 ? null : fail('Wrong password', 'unauthorized', 401)
}

async function adminStats(body: { password?: string }) {
  const denied = checkAdmin(body.password); if (denied) return denied
  const [{ count: total }, { data: results }, { data: answers }, { data: questions }] = await Promise.all([
    db.from('attempts').select('*', { count: 'exact', head: true }),
    db.from('results').select('id, nickname, score, correct_count, duration_ms, created_at').order('created_at', { ascending: false }).limit(30),
    db.from('attempt_answers').select('question_id, is_correct, attempt_id'),
    db.from('questions').select('id, prompt').order('order'),
  ])
  const completed = results ?? []
  const { count: completedCount } = await db.from('results').select('*', { count: 'exact', head: true })
  const { data: agg } = await db.from('results').select('score, correct_count')
  const n = agg?.length ?? 0
  const perQuestionAccuracy = (questions ?? []).map((q) => {
    const rows = (answers ?? []).filter((x) => x.question_id === q.id)
    return { questionId: q.id, prompt: q.prompt, correctRate: rows.length ? Math.round((rows.filter((x) => x.is_correct).length / rows.length) * 100) : 0 }
  })
  return json({
    totalAttempts: total ?? 0, completedAttempts: completedCount ?? 0,
    averageScore: n ? Math.round(agg!.reduce((s, r) => s + r.score, 0) / n) : 0,
    averageAccuracy: n ? Math.round((agg!.reduce((s, r) => s + r.correct_count, 0) / (n * TOTAL_QUESTIONS)) * 100) : 0,
    perQuestionAccuracy, recent: completed,
  })
}

async function adminReset(body: { password?: string; confirm?: string }) {
  const denied = checkAdmin(body.password); if (denied) return denied
  if (body.confirm !== 'RESET') return fail('Confirmation text missing', 'bad_request')
  const { count } = await db.from('results').select('*', { count: 'exact', head: true })
  // Deleting attempts cascades to attempt_answers and results.
  const { error } = await db.from('attempts').delete().not('id', 'is', null)
  if (error) return fail('Reset failed', 'db', 500)
  return json({ deleted: count ?? 0 })
}

// ---------------------------------------------------------------- router
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('POST only', 'method', 405)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return fail('Invalid JSON', 'bad_request') }
  try {
    switch (body.action) {
      case 'start': return await start(body)
      case 'answer': return await answer(body)
      case 'finish': return await finish(body)
      case 'admin_stats': return await adminStats(body)
      case 'admin_reset': return await adminReset(body)
      default: return fail('Unknown action', 'bad_request')
    }
  } catch (e) {
    console.error(e)
    return fail('Internal error', 'internal', 500)
  }
})
