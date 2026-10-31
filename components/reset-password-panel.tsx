'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

export function ResetPasswordPanel({ signedIn }: { signedIn: boolean }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  // New invitees arrive with ?invite=1. They may skip choosing a password and use Continue with Google instead.
  const [invite, setInvite] = useState(false)
  useEffect(() => setInvite(new URLSearchParams(window.location.search).get('invite') === '1'), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (password.length < 12) return setMessage('Use at least 12 characters.')
    if (password !== confirm) return setMessage('The two passwords do not match.')
    setBusy(true); setMessage('')
    try {
      const { error } = await createClient().auth.updateUser({ password })
      if (error) setMessage(error.code === 'same_password' ? 'Choose a password you have not used before.' : error.code === 'weak_password' ? 'Choose a stronger password with at least 12 characters.' : 'Unable to update your password. Request a new reset link and try again.')
      else { setDone(true); setTimeout(() => window.location.assign('/'), 1800) }
    } catch { setMessage('Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <header className="flex flex-col gap-2">
          <ShieldCheck className="size-9 text-primary" aria-hidden="true" />
          <h1 className="text-balance text-2xl font-semibold">{invite ? 'Choose a password' : 'Choose a new password'}</h1>
          <p className="leading-relaxed text-muted-foreground">{signedIn ? (invite ? 'Choose a password for your SVLA Compliance account, or skip it if you will sign in with Google.' : 'Enter a new password for your SVLA Compliance account.') : 'This reset link is not active. Go back to the sign-in page and request a new one.'}</p>
        </header>
        {done ? <p role="status" className="text-sm leading-relaxed">Your password has been updated. Taking you to your workspace…</p> : signedIn ? (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <FieldGroup>
              <Field><FieldLabel htmlFor="new-password">New password</FieldLabel><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={128} required /><p className="text-sm text-muted-foreground">Use at least 12 characters.</p></Field>
              <Field><FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={12} maxLength={128} required /></Field>
            </FieldGroup>
            {message && <p role="alert" className="text-sm leading-relaxed text-destructive">{message}</p>}
            <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : invite ? 'Save password' : 'Update password'}</Button>
            {invite && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <Button type="button" variant="outline" disabled={busy} onClick={() => window.location.assign('/')}>Skip — I&apos;ll sign in with Google</Button>
                <p className="text-sm leading-relaxed text-muted-foreground">Works if this email is a Google account (Gmail or svlacrosse.org). You can set a password later with Forgot password.</p>
              </div>
            )}
          </form>
        ) : <a href="/" className="font-medium text-primary underline underline-offset-4">Back to sign in</a>}
      </section>
    </main>
  )
}
