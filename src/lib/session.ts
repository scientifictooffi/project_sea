const KEY = 'sea-attempt'

export interface StoredSession {
  attemptId: string
  token: string
  nickname: string
}

export function saveSession(s: StoredSession) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ }
}
export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch { return null }
}
export function clearSession() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}
