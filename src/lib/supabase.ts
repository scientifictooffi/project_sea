import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when no Supabase config is present: the app runs fully in memory. */
export const MOCK_MODE = !url || !anonKey || url.includes('YOUR-PROJECT')

export const supabase: SupabaseClient | null = MOCK_MODE
  ? null
  : createClient(url!, anonKey!, { auth: { persistSession: false } })
