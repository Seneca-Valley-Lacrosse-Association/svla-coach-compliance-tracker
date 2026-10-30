'use client'

import { useId, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { PAY_STATUSES, ROLES, TEAMS, TEAM_PROGRAMS, type Coach } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CoachProgramsField } from '@/components/coach-programs-field'

const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-brand'
const emptyCoach: Omit<Coach, 'id'> = {
  name: '', email: '', phone: '', team: '8U', role: 'Assistant Coach',
  pay: 'Volunteer', paResident10Years: false, alsoCoachesYouth: false,
}

export function AddCoachDialog({ onAdded, initialEmail = '', label = 'Add Coach', variant = 'default' }: { onAdded: (name: string) => void; initialEmail?: string; label?: string; variant?: 'default' | 'outline' }) {
  const { coaches, addCoach, isDemo } = useApp()
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const id = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ ...emptyCoach, email: initialEmail })
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})

  function changeOpen(next: boolean) {
    setOpen(next)
    setDraft({ ...emptyCoach, email: initialEmail })
    setErrors({})
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setSaveError('')
    const nextErrors: typeof errors = {}
    const name = draft.name.trim()
    const email = draft.email.trim().toLowerCase()
    if (!name) nextErrors.name = 'Enter the coach’s name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.'
    else if (coaches.some((coach) => coach.email.toLowerCase() === email)) nextErrors.email = 'A coach with this email is already on the roster.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      document.getElementById(`${id}-${nextErrors.name ? 'name' : 'email'}`)?.focus()
      return
    }
    setBusy(true)
    try {
      await addCoach({ ...draft, name, email })
      onAdded(name)
      changeOpen(false)
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save coach.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger disabled={isDemo} render={<Button variant={variant} className="h-10 px-4" disabled={isDemo} />}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
        }}>
          <DialogHeader>
            <DialogTitle>Add coach</DialogTitle>
            <DialogDescription>Add a coach to the secure roster. They can create an account with this exact email to access their checklist. No invitation email is sent automatically.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor={`${id}-name`}>Full name</FieldLabel>
              <Input id={`${id}-name`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoComplete="name" maxLength={100} required aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-error` : undefined} />
              {errors.name && <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
              <Input id={`${id}-email`} type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} autoComplete="email" maxLength={254} required aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-error` : undefined} />
              {errors.email && <FieldError id={`${id}-email-error`}>{errors.email}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-phone`}>Phone (optional)</FieldLabel>
              <Input id={`${id}-phone`} type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} autoComplete="tel" maxLength={40} />
            </Field>
            <FieldGroup className="sm:flex-row">
              <Field>
                <FieldLabel htmlFor={`${id}-team`}>Team</FieldLabel>
                <select id={`${id}-team`} className={selectClass} value={draft.team} onChange={(event) => { const team = event.target.value as Coach['team']; setDraft({ ...draft, team, alsoCoachesYouth: TEAM_PROGRAMS[team].includes('youth') ? false : draft.alsoCoachesYouth }) }}>
                  {TEAMS.map((team) => <option key={team}>{team}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-role`}>Role</FieldLabel>
                <select id={`${id}-role`} className={selectClass} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Coach['role'] })}>
                  {ROLES.map((role) => <option key={role}>{role}</option>)}
                </select>
              </Field>
            </FieldGroup>
            <CoachProgramsField team={draft.team} alsoCoachesYouth={!!draft.alsoCoachesYouth} onChange={(alsoCoachesYouth) => setDraft({ ...draft, alsoCoachesYouth })} />
            <Field>
              <FieldLabel htmlFor={`${id}-pay`}>Pay status</FieldLabel>
              <select id={`${id}-pay`} className={selectClass} value={draft.pay} onChange={(event) => { const pay = event.target.value as Coach['pay']; setDraft({ ...draft, pay, paResident10Years: pay === 'Paid' ? false : draft.paResident10Years }) }}>
                {PAY_STATUSES.map((pay) => <option key={pay}>{pay}</option>)}
              </select>
            </Field>
            {draft.pay !== 'Paid' && (
            <Field>
              <FieldLabel htmlFor={`${id}-resident`}>PA resident for 10 consecutive years?</FieldLabel>
              <select id={`${id}-resident`} className={selectClass} value={draft.paResident10Years ? 'yes' : 'no'} onChange={(event) => setDraft({ ...draft, paResident10Years: event.target.value === 'yes' })} aria-describedby={`${id}-resident-help`}>
                <option value="no">No / not confirmed</option>
                <option value="yes">Yes</option>
              </select>
              <FieldDescription id={`${id}-resident-help`}>Applies to volunteers only. An eligible volunteer may use the disclosure affidavit instead of fingerprints. Paid coaches always need fingerprints.</FieldDescription>
            </Field>
            )}
          </FieldGroup>
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <p className="text-sm leading-relaxed text-muted-foreground">Records are saved securely and remain after reloading.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add coach'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
