'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

type Mode = 'signin' | 'signup' | 'forgot'

function authErrorFromUrl() {
  if (typeof window === 'undefined') return ''
  const authError = new URLSearchParams(window.location.search).get('authError')
  if (authError === 'google') return 'Google sign-in did not complete. Please try again, or sign in with your email and password.'
  return authError
    ? 'That link has expired or was opened in a different browser than the one you requested it from. Request a new link and open it in the same browser.'
    : ''
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

// Lets other pages link straight to the reset form, e.g. /?mode=forgot
function initialModeFromUrl(): Mode {
  if (typeof window === 'undefined') return 'signin'
  return new URLSearchParams(window.location.search).get('mode') === 'forgot' ? 'forgot' : 'signin'
}

export function AuthPanel({ onSignedIn }: { onSignedIn: () => Promise<unknown> }) {
  const [mode, setMode] = useState<Mode>(initialModeFromUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(authErrorFromUrl)
  const signUp = mode === 'signup'
  const forgot = mode === 'forgot'

  function switchMode(next: Mode) { setMode(next); setMessage(''); setPassword('') }

  // Sends the browser to Google; it returns through /auth/callback, which finishes sign-in.
  // Access is still decided by matching the Google email against the coach and board rosters.
  async function signInWithGoogle() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const origin = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? window.location.origin
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/auth/callback?provider=google`, queryParams: { prompt: 'select_account' } },
      })
      if (error) { setMessage('Google sign-in is temporarily unavailable. Please sign in with your email and password.'); setBusy(false) }
    } catch { setMessage('Unable to connect. Please try again.'); setBusy(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const db = createClient()
      if (forgot) {
        const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? window.location.origin}/auth/callback?next=/auth/reset`,
        })
        if (error && (error.code?.includes('rate_limit') || error.status === 429)) setMessage('Too many attempts. Please wait a few minutes before trying again.')
        else if (error?.code === 'email_address_not_authorized') setMessage('Email delivery is restricted. Contact the board to finish email setup.')
        else setMessage('If an account exists for that email, a password reset link is on its way. Open it in this same browser. The link expires after one hour.')
        return
      }
      const result = signUp
        ? await db.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` } })
        : await db.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) {
        const code = result.error.code
        setMessage(code === 'email_not_confirmed' ? 'Confirm your email using the link in your inbox before signing in.' : code === 'weak_password' ? 'Choose a stronger password with at least 12 characters.' : code?.includes('rate_limit') || result.error.status === 429 ? 'Too many attempts. Please wait before trying again.' : code === 'email_address_not_authorized' ? 'Email delivery is restricted. Contact the board to finish email setup.' : code === 'invalid_credentials' ? 'Invalid email or password.' : signUp ? 'Unable to create an account. Check your email and password or try signing in.' : 'Sign-in is temporarily unavailable. Please try again.')
      } else if (result.data.session) {
        await onSignedIn()
      } else {
        setMessage('Check your email for a confirmation link. After confirming, return here to sign in. If you already have an account, use Sign in.')
      }
    } catch { setMessage('Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <header className="flex flex-col gap-2">
          <ShieldCheck className="size-9 text-primary" aria-hidden="true" />
          <h1 className="text-balance text-2xl font-semibold">SVLA Compliance</h1>
          <p className="leading-relaxed text-muted-foreground">{forgot ? 'Enter your account email and we will send you a link to choose a new password.' : signUp ? 'Create an account with the email address on your coach or board roster.' : 'Sign in to securely manage your clearances and certifications.'}</p>
        </header>
        {!forgot && (
          <div className="flex flex-col gap-3">
            <Button type="button" variant="outline" disabled={busy} onClick={signInWithGoogle} className="gap-3">
              <GoogleMark />
              Continue with Google
            </Button>
            <p className="text-sm leading-relaxed text-muted-foreground">Use the Google account with the same email your invite was sent to. Other addresses won&apos;t find your records.</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}
        <form onSubmit={submit} className="flex flex-col gap-5" onKeyDown={e => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault() }}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="auth-email">Email</FieldLabel><Input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></Field>
            {!forgot && <Field><FieldLabel htmlFor="auth-password">Password</FieldLabel><Input id="auth-password" type="password" autoComplete={signUp ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={signUp ? 12 : 1} required maxLength={128} />{signUp && <p className="text-sm text-muted-foreground">Use at least 12 characters.</p>}</Field>}
          </FieldGroup>
          {message && <p role="status" className="text-sm leading-relaxed">{message}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : forgot ? 'Send reset link' : signUp ? 'Create account' : 'Sign in'}</Button>
          {mode === 'signin' && <Button type="button" variant="link" disabled={busy} onClick={() => switchMode('forgot')}>Forgot your password?</Button>}
          {forgot
            ? <Button type="button" variant="ghost" disabled={busy} onClick={() => switchMode('signin')}>Back to sign in</Button>
            : <Button type="button" variant="ghost" disabled={busy} onClick={() => switchMode(signUp ? 'signin' : 'signup')}>{signUp ? 'Already have an account? Sign in' : 'Need an account? Create one'}</Button>}
        </form>
        <div className="flex flex-col gap-2 border-t pt-5">
          <Link href="/demo" className="font-medium text-primary underline underline-offset-4">Open board demo — 5 sample coaches</Link>
          <p className="text-sm leading-relaxed text-muted-foreground">The demo is read-only and separate from live records. Account creation does not grant board access.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">Can&apos;t get in? Email <a className="font-medium text-primary underline underline-offset-4" href="mailto:it@svlacrosse.org">it@svlacrosse.org</a>.</p>
          <a href="https://www.svlacrosse.org/privacy-policy-svla-compliance-tracker/" target="_blank" rel="noopener" className="text-sm font-medium text-primary underline underline-offset-4">Privacy policy</a>
        </div>
      </section>
    </main>
  )
}
