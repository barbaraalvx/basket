import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

// Each phone gets an invisible anonymous user. Shared promise so parallel
// callers don't create two users.
let sessionPromise

export function ensureSession() {
  sessionPromise ??= (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session

    const { data: signIn, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return signIn.session
  })()

  return sessionPromise
}
