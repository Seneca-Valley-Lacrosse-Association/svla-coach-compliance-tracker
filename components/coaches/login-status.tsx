'use client'

import { useState } from 'react'
import { Copy, KeyRound, Mail } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { formatDate } from '@/lib/compliance'
import { loginStateOf, type Coach, type LoginState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** Sign-in times are shown in Eastern time so everyone on the board sees the same thing. */
export function formatLastLogin(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })
}

const LABELS: Record<LoginState, string> = { none: 'No login', invited: 'Invited', active: 'Active' }
const TONES: Record<LoginState, string> = {
  none: 'bg-slate-100 text-slate-700 ring-slate-200',
  invited: 'bg-amber-50 text-amber-900 ring-amber-300',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}
const DOTS: Record<LoginState, string> = { none: 'bg-slate-500', invited: 'bg-amber-500', active: 'bg-emerald-600' }

export function LoginBadge({ state }: { state: LoginState }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset', TONES[state])}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOTS[state])} />
      {LABELS[state]}
    </span>
  )
}

/** Login state for one coach, looked up by email. Renders nothing useful in the demo (no login data). */
export function useLogin(coach: Coach) {
  const { loginByEmail } = useApp()
  const info = loginByEmail[coach.email.toLowerCase()]
  return { info, state: loginStateOf(info) }
}

export function LoginCell({ coach }: { coach: Coach }) {
  const { info, state } = useLogin(coach)
  const last = formatLastLogin(info?.last_sign_in_at)
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <LoginBadge state={state} />
      {state === 'active' && <span className="text-xs text-muted-foreground">{last ? `Last login ${last}` : 'Has not signed in yet'}</span>}
    </span>
  )
}

// Board-only panel on a coach's page: see whether they can sign in, send or resend the invite,
// or copy a one-time sign-in link to hand over yourself when email does not arrive.
export function PortalAccess({ coach }: { coach: Coach }) {
  const { inviteCoach, isDemo } = useApp()
  const { info, state } = useLogin(coach)
  const [busy, setBusy] = useState<'' | 'email' | 'link'>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  async function run(deliver: 'email' | 'link') {
    if (busy) return
    setBusy(deliver); setError(''); setMessage(''); setLink(''); setCopied(false)
    try {
      const result = await inviteCoach(coach.id, deliver)
      if (result.link) setLink(result.link)
      if (result.emailSent) setMessage(`Invite emailed to ${coach.email}.${isDemo ? ' (Demo: no email was actually sent.)' : ''}`)
      else if (deliver === 'email') setMessage('The email could not be sent, so copy the sign-in link below and send it to the coach yourself.')
      else setMessage('Copy this one-time link and send it to the coach. It works once and expires, and anyone who has it can sign in as them, so share it privately.' + (isDemo ? ' (Demo: this sample link does not work.)' : ''))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the invite.') }
    finally { setBusy('') }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true) } catch { setError('Could not copy automatically. Select the link and copy it.') }
  }

  return (
    <section aria-labelledby="portal-access" className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="portal-access" className="text-lg font-semibold text-navy">Portal access</h2>
        <LoginBadge state={state} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {state === 'active'
          ? `${coach.name} has an account${info?.last_sign_in_at ? ` and last signed in ${formatLastLogin(info.last_sign_in_at)}` : ''}. If they lose their password they can use “Forgot your password?” on the sign-in page.`
          : state === 'invited'
            ? `An invite was sent${info?.invited_at ? ` ${formatDate(info.invited_at)}` : ''} but ${coach.name} has not set up an account yet. Resend it, or copy a link to send yourself.`
            : `${coach.name} has no account yet. Until then you can enter their records for them. Send an invite so they can upload their own documents.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {state !== 'active' && (
          <Button type="button" className="h-10 px-4" disabled={!!busy} onClick={() => void run('email')}>
            <Mail data-icon="inline-start" aria-hidden="true" />
            {busy === 'email' ? 'Sending…' : state === 'invited' ? 'Resend invite' : 'Send invite'}
          </Button>
        )}
        <Button type="button" variant="outline" className="h-10 px-4" disabled={!!busy} onClick={() => void run('link')}>
          <KeyRound data-icon="inline-start" aria-hidden="true" />
          {busy === 'link' ? 'Creating…' : 'Copy sign-in link'}
        </Button>
      </div>
      {message && <p role="status" className="text-sm leading-relaxed">{message}</p>}
      {link && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={link} aria-label="One-time sign-in link" onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
          <Button type="button" variant="outline" className="h-10 px-4" onClick={() => void copy()}>
            <Copy data-icon="inline-start" aria-hidden="true" />{copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
