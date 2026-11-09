import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublicKey)
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl!, supabasePublicKey!, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null
