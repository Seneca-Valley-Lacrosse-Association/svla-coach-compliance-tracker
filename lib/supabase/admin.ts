import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Server-only client with the service-role key. It bypasses row-level security, so it must only be used
// AFTER the caller has been verified as a board member, and only for things the user's own session cannot do
// (creating sign-in links). Never import this from a client component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
