import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only these in-app destinations may be requested through ?next=, so the link can never redirect off-site.
const ALLOWED_NEXT = new Set(['/', '/auth/reset'])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const requested = url.searchParams.get('next') ?? '/'
  const next = ALLOWED_NEXT.has(requested) ? requested : '/'
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  // Google sign-in returns here too; tell the sign-in page which flow failed so it shows the right message.
  const failed = url.searchParams.get('provider') === 'google' ? 'google' : '1'
  return NextResponse.redirect(new URL(`/?authError=${failed}`, url.origin))
}
