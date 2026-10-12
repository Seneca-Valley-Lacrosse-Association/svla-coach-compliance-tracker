'use client'

import { useState, type FormEvent } from 'react'
import { UserPlus, UserMinus } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'

export function BoardMembersView() {
  const { boardMembers, addBoardMember, removeBoardMember, email: myEmail, isDemo } = useApp()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
                <span className="font-medium">{m.email}{mine && <span className="ml-2 text-sm font-normal text-muted-foreground">(you)</span>}</span>
                {mine
                  ? <span className="text-sm text-muted-foreground">Cannot remove yourself</span>
                  : <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => handleRemove(m.email)}><UserMinus aria-hidden="true" />Remove</Button>}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
