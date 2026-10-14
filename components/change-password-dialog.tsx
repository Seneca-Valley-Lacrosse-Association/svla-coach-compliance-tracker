'use client'

import { useId, useState, type FormEvent } from 'react'
import { useApp } from '@/lib/app-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Lets anyone who is signed in (coach or board) choose a new password. The current password is checked first,
// so someone who walks up to an unlocked screen cannot quietly take over the account.
export function ChangePasswordDialog() {
  const { email } = useApp()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  function changeOpen(value: boolean) {
    setOpen(value)
    if (!value) { setCurrent(''); setNext(''); setConfirm(''); setMessage(''); setDone(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (next.length < 12) return setMessage('Use at least 12 characters.')
    if (next !== confirm) return setMessage('The two new passwords do not match.')
    if (next === current) return setMessage('Choose a password you are not already using.')
    setBusy(true); setMessage('')
    try {
      const db = createClient()
      const check = await db.auth.signInWithPassword({ email, password: current })
      if (check.error) return setMessage(check.error.code === 'invalid_credentials' ? 'Your current password is not correct.' : 'Unable to check your current password. Please try again.')
      const { error } = await db.auth.updateUser({ password: next })
      if (error) setMessage(error.code === 'same_password' ? 'Choose a password you have not used before.' : error.code === 'weak_password' ? 'Choose a stronger password with at least 12 characters.' : 'Unable to update your password. Please try again.')
      else setDone(true)
    } catch { setMessage('Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<button type="button" className="shrink-0 text-sm underline underline-offset-4" />}>Change password</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <>
            <DialogHeader><DialogTitle>Password updated</DialogTitle><DialogDescription>Your new password is active. Use it the next time you sign in.</DialogDescription></DialogHeader>
            <DialogFooter><Button type="button" onClick={() => changeOpen(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <DialogHeader><DialogTitle>Change your password</DialogTitle><DialogDescription>Enter your current password, then choose a new one of at least 12 characters.</DialogDescription></DialogHeader>
            <FieldGroup>
              <Field><FieldLabel htmlFor={`${id}-current`}>Current password</FieldLabel><Input id={`${id}-current`} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} maxLength={128} required /></Field>
              <Field><FieldLabel htmlFor={`${id}-new`}>New password</FieldLabel><Input id={`${id}-new`} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={12} maxLength={128} required /></Field>
              <Field><FieldLabel htmlFor={`${id}-confirm`}>Confirm new password</FieldLabel><Input id={`${id}-confirm`} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={12} maxLength={128} required /></Field>
            </FieldGroup>
            {message && <p role="alert" className="text-sm leading-relaxed text-destructive">{message}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Update password'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
