'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

// Links in our emails land here. Verification happens only when the person clicks the button, so email
// security scanners that pre-open links cannot use up the one-time token, and the link works in any browser.
const TYPES = ['recovery', 'email', 'signup', 'invite'] as const
type LinkType = (typeof TYPES)[number]
const NEXT_BY_TYPE: Record<LinkType, string> = { recovery: '/auth/reset', email: '/', signup: '/', invite: '/auth/reset' }
const COPY: Record<LinkType, { title: string; text: string; button: string }> = {
  recovery: { title: 'Reset your password', text: 'Select the button to continue and choose a new password.', button: 'Continue' },
  email: { title: 'Confirm your email', text: 'Select the button to confirm your email address and sign in.', button: 'Confirm email' },
  signup: { title: 'Confirm your email', text: 'Select the button to confirm your email address and sign in.', button: 'Confirm email' },
  invite: { title: 'Set up your account', text: 'Select the button to confirm your email and choose a password.', button: 'Continue' },
}

export function ConfirmLinkPanel() {
  // Read the query string after mount (avoids needing a Suspense boundary during static build).
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => setParams(new URLSearchParams(window.location.search)), [])
  const tokenHash = params?.get('token_hash') ?? ''
  const rawType = params?.get('type') ?? ''
  const type = (TYPES as readonly string[]).includes(rawType) ? (rawType as LinkType) : null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (busy || !type || !tokenHash) return
    setBusy(true); setError('')
    try {
      const { error: verifyError } = await createClient().auth.verifyOtp({ type, token_hash: tokenHash })
      if (verifyError) setError('This link has expired or was already used. Go back to the sign-in page and request a new one.')
      else window.location.assign(NEXT_BY_TYPE[type])
    } catch { setError('Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }

  const copy = type ? COPY[type] : null
  if (!params) return <main className="flex min-h-dvh items-center justify-center"><p role="status">Loading…</p></main>
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <header className="flex flex-col gap-2">
          <ShieldCheck className="size-9 text-primary" aria-hidden="true" />
          <h1 className="text-balance text-2xl font-semibold">{copy?.title ?? 'Link not valid'}</h1>
          <p className="leading-relaxed text-muted-foreground">{copy && tokenHash ? copy.text : 'This link is incomplete. Go back to the sign-in page and request a new one.'}</p>
        </header>
        {copy && tokenHash && <Button onClick={confirm} disabled={busy}>{busy ? 'Please wait…' : copy.button}</Button>}
        {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
        <a href="/" className="text-sm font-medium text-primary underline underline-offset-4">Back to sign in</a>
      </section>
    </main>
  )
}
