'use client'

import { useState, type FormEvent } from 'react'
import { Copy, KeyRound, Mail, UserPlus, UserMinus } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'

export function BoardMembersView() {
  const { boardMembers, addBoardMember, removeBoardMember, inviteBoardMember, email: myEmail, isDemo } = useApp()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [link, setLink] = useState<{ email: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteError, setInviteError] = useState('')

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.') }
    finally { setBusy(false) }
  }
  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError('Enter a valid email address.')
    await run(async () => { await addBoardMember(value); setEmail('') }, `${value} now has board access. They sign in by creating an account with this exact email address and confirming it.`)
  }
  async function handleInvite(target: string, deliver: 'email' | 'link') {
    if (busy) return
    setBusy(true); setInviteError(''); setInviteMessage(''); setLink(null); setCopied(false)
    try {
      const result = await inviteBoardMember(target, deliver)
      if (result.link) setLink({ email: target, url: result.link })
      if (result.emailSent) setInviteMessage(`Invite emailed to ${target}.`)
      else if (deliver === 'email') setInviteMessage(`The email to ${target} could not be sent, so copy the sign-in link below and send it to them yourself.`)
      else setInviteMessage(`Copy this one-time link and send it to ${target}. It works once and expires, and anyone who has it can sign in as them, so share it privately.`)
    } catch (e) { setInviteError(e instanceof Error ? e.message : 'Could not create the invite.') }
    finally { setBusy(false) }
  }
  async function copyLink() {
    if (!link) return
    try { await navigator.clipboard.writeText(link.url); setCopied(true) } catch { setInviteError('Could not copy automatically. Select the link and copy it.') }
  }
  async function handleRemove(target: string) {
    if (!window.confirm(`Remove board access for ${target}? They will keep any coach record they have.`)) return
    await run(() => removeBoardMember(target), `${target} no longer has board access.`)
  }

  return (
    <>
      <PageHeader
        title="Board Access"
        description="Board members can review submissions, manage coaches and requirements, and export data. Add or remove board members here."
      />
      <section aria-labelledby="add-board" className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h2 id="add-board" className="mb-1 text-lg font-semibold text-navy">Add a board member</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Enter their email address. They then create an account at the sign-in page with that exact email and confirm it from the email Supabase sends.
          Access is granted only to the confirmed owner of that address.
        </p>
        <form onSubmit={handleAdd} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="board-email">Email address</Label>
            <Input id="board-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="off" disabled={isDemo} className="h-10 bg-card text-base" />
          </div>
          <Button type="submit" className="h-10 px-4" disabled={busy || isDemo}>
            <UserPlus aria-hidden="true" />
            Add board member
          </Button>
        </form>
        <p role="status" className={message ? 'mt-3 text-sm text-muted-foreground' : 'sr-only'}>{message}</p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      <section aria-labelledby="current-board" className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 id="current-board" className="mb-4 text-lg font-semibold text-navy">Current board members ({boardMembers.length})</h2>
        <ul className="divide-y">
          {boardMembers.map((m) => {
            const mine = m.email.toLowerCase() === myEmail.toLowerCase()
            return (
              <li key={m.email} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{m.email}{mine && <span className="ml-2 text-sm font-normal text-muted-foreground">(you)</span>}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.lastSignInAt
                      ? `Last signed in ${new Date(m.lastSignInAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })} ET`
                      : 'Has not signed in yet'}
                  </span>
                </span>
                {mine
                  ? <span className="text-sm text-muted-foreground">Cannot remove yourself</span>
                  : (
                    <span className="flex flex-wrap justify-end gap-2">
                      {!m.lastSignInAt && !isDemo && (
                        <>
                          <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => void handleInvite(m.email, 'email')}><Mail aria-hidden="true" />Resend invite</Button>
                          <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => void handleInvite(m.email, 'link')}><KeyRound aria-hidden="true" />Copy sign-in link</Button>
                        </>
                      )}
                      <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => handleRemove(m.email)}><UserMinus aria-hidden="true" />Remove</Button>
                    </span>
                  )}
              </li>
            )
          })}
        </ul>
        <p role="status" className={inviteMessage ? 'mt-3 text-sm leading-relaxed' : 'sr-only'}>{inviteMessage}</p>
        {inviteError && <p role="alert" className="mt-3 text-sm text-destructive">{inviteError}</p>}
        {link && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link.url} aria-label={`One-time sign-in link for ${link.email}`} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
            <Button type="button" variant="outline" className="h-10 px-4" onClick={() => void copyLink()}>
              <Copy aria-hidden="true" />{copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        )}
      </section>
    </>
  )
}
