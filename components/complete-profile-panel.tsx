'use client'

import { useState, type FormEvent } from 'react'
import { ClipboardList } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { ROLES, TEAMS, type Coach } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'

const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-brand'

// Shown once to a confirmed coach who is not on the roster yet. They describe themselves; the board sets paid/volunteer status.
export function CompleteProfilePanel() {
  const { email, registerSelf, signOut } = useApp()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [team, setTeam] = useState<Coach['team']>(TEAMS[0])
  const [role, setRole] = useState<Coach['role']>('Assistant Coach')
  const [resident, setResident] = useState<'' | 'yes' | 'no'>('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!name.trim()) return setMessage('Enter your full name.')
    if (!resident) return setMessage('Answer the Pennsylvania residency question.')
    setBusy(true); setMessage('')
    try { await registerSelf({ name: name.trim(), phone: phone.trim(), team, role, paResident10Years: resident === 'yes' }) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your profile.') }
    finally { setBusy(false) }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <header className="flex flex-col gap-2">
          <ClipboardList className="size-9 text-primary" aria-hidden="true" />
          <h1 className="text-balance text-2xl font-semibold">Complete your coach profile</h1>
          <p className="leading-relaxed text-muted-foreground">Signed in as {email}. Tell us about your coaching role. The SVLA board will review your details. You will get an email once you are approved and can log in.</p>
        </header>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <FieldGroup>
            <Field><FieldLabel htmlFor="cp-name">Full name</FieldLabel><Input id="cp-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={120} required /></Field>
            <Field><FieldLabel htmlFor="cp-phone">Phone (optional)</FieldLabel><Input id="cp-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" maxLength={40} /></Field>
            <FieldGroup className="sm:flex-row">
              <Field><FieldLabel htmlFor="cp-team">Team</FieldLabel><select id="cp-team" className={selectClass} value={team} onChange={e => setTeam(e.target.value as Coach['team'])}>{TEAMS.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field><FieldLabel htmlFor="cp-role">Role</FieldLabel><select id="cp-role" className={selectClass} value={role} onChange={e => setRole(e.target.value as Coach['role'])}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></Field>
            </FieldGroup>
            <Field>
              <FieldLabel htmlFor="cp-resident">Have you lived in Pennsylvania for the past 10 consecutive years?</FieldLabel>
              <select id="cp-resident" className={selectClass} value={resident} onChange={e => setResident(e.target.value as 'yes' | 'no')} aria-describedby="cp-resident-help">
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              <FieldDescription id="cp-resident-help">Volunteers who answer yes may use a disclosure affidavit instead of fingerprints. If the board marks you as paid, fingerprints are required either way.</FieldDescription>
            </Field>
          </FieldGroup>
          {message && <p role="alert" className="text-sm leading-relaxed text-destructive">{message}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Submit for approval'}</Button>
          <button type="button" onClick={() => void signOut()} className="text-sm text-muted-foreground underline">Sign out</button>
        </form>
      </section>
    </main>
  )
}
