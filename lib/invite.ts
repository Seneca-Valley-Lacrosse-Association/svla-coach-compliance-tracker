import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://compliance.svlacrosse.org'

/**
 * Creates a one-time sign-in link for a roster email. New people get an "invite" link (which creates and confirms
 * their account); people who already have an account get a "recovery" link. Either way the link opens our own
 * /auth/confirm page, where the person chooses a password. The link is never stored; it is returned to the caller.
 */
export async function createAccessLink(email: string): Promise<{ link: string } | { error: string }> {
  const admin = createAdminClient()
  if (!admin) return { error: 'Invites are not set up yet: the server is missing SUPABASE_SERVICE_ROLE_KEY.' }
  const address = email.trim().toLowerCase()
  for (const type of ['invite', 'recovery'] as const) {
    const { data, error } = await admin.auth.admin.generateLink({ type, email: address })
    const token = data?.properties?.hashed_token
    if (!error && token) return { link: `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${type}` }
  }
  return { error: 'Could not create a sign-in link for this email. Try again in a moment.' }
}
