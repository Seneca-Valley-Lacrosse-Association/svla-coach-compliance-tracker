'use client'

import { useId, useState, type FormEvent } from 'react'
import { TEAMS, type Team } from '@/lib/types'
import { useApp } from '@/lib/app-store'
import { surveyCommand } from '@/lib/use-surveys'
import { addDays, COACHING_TEAMS, DEFAULT_REMINDERS, emailDueToday, shortDate, todayET, type SurveyCycle } from '@/lib/surveys'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Draft = Pick<SurveyCycle, 'title' | 'seasonLabel' | 'nextSeasonLabel' | 'intro' | 'sendOn' | 'dueOn' | 'audienceTeams' | 'reminderEveryDays' | 'remindDayBeforeDue' | 'remindAfterDue' | 'afterDueDays' | 'maxReminders'> & { closeOn: string }

function blank(): Draft {
  const year = new Date().getFullYear() + (new Date().getMonth() >= 7 ? 1 : 0)
  return {
    title: `${year} SVLA Coaching Survey`, seasonLabel: String(year), nextSeasonLabel: `${year}/${year + 1}`,
    intro: 'The SVLA Board of Directors is asking for feedback from its coaches to improve the player and membership experience.',
    sendOn: `${year}-06-22`, dueOn: `${year}-07-06`, closeOn: '', audienceTeams: [...COACHING_TEAMS], ...DEFAULT_REMINDERS,
  }
}

/** The emails one coach who never responds would get, so the board can see what the settings do. */
export function reminderPlan(d: Pick<Draft, 'sendOn' | 'dueOn' | 'reminderEveryDays' | 'remindDayBeforeDue' | 'remindAfterDue' | 'afterDueDays' | 'maxReminders'> & { closeOn: string | null }) {
  const plan: { date: string; kind: string }[] = []
  const coach = { invitedAt: null as string | null, remindersSent: 0, lastEmailedOn: null as string | null, submittedAt: null }
  const settings = { ...d, closeOn: d.closeOn || null }
  const end = addDays(d.dueOn, d.remindAfterDue ? d.afterDueDays : 0)
  for (let day = d.sendOn; day <= end && plan.length < 40; day = addDays(day, 1)) {
    const kind = emailDueToday(settings, coach, day)
    if (!kind) continue
    plan.push({ date: day, kind })
    if (kind === 'invite') coach.invitedAt = `${day}T12:00:00Z`
    if (kind === 'reminder' || kind === 'overdue') coach.remindersSent++
    coach.lastEmailedOn = day
  }
  return plan
}
const KIND_TEXT: Record<string, string> = { invite: 'Survey sent', reminder: 'Reminder', due_tomorrow: 'Due-tomorrow reminder', overdue: 'Past-due reminder' }

export function CycleDialog({ open, onOpenChange, cycle, onSaved, test = false }: { open: boolean; onOpenChange: (open: boolean) => void; cycle?: SurveyCycle; onSaved: (id?: string) => void; test?: boolean }) {
  const id = useId()
  const { email } = useApp()
  const isTest = cycle ? !!cycle.testEmails : test
  const testBlank = (): Draft => ({ ...blank(), title: 'TEST - Coaching Survey', sendOn: todayET(), dueOn: addDays(todayET(), 7), closeOn: '' })
  const [draft, setDraft] = useState<Draft>(() => cycle ? { ...cycle, closeOn: cycle.closeOn ?? '' } : isTest ? testBlank() : blank())
  const [testText, setTestText] = useState(() => (cycle?.testEmails ?? [email]).filter(Boolean).join('\n'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sent = !!cycle && cycle.status !== 'scheduled'
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const plan = draft.sendOn && draft.dueOn && draft.dueOn >= draft.sendOn ? reminderPlan(draft) : []

  function change(next: boolean) {
    if (next) { setDraft(cycle ? { ...cycle, closeOn: cycle.closeOn ?? '' } : isTest ? testBlank() : blank()); setTestText((cycle?.testEmails ?? [email]).filter(Boolean).join('\n')) }
    setError('')
    onOpenChange(next)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!sent && draft.sendOn < todayET()) return setError('Choose a send date of today or later.')
    if (draft.dueOn < draft.sendOn) return setError('The due date must be on or after the send date.')
    if (draft.closeOn && draft.closeOn < draft.dueOn) return setError('The close date must be on or after the due date.')
    const testEmails = isTest ? [...new Set(testText.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))] : null
    if (testEmails && (!testEmails.length || testEmails.length > 10 || testEmails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))) return setError('Enter one to ten valid email addresses for the test run.')
    if (!testEmails && !draft.audienceTeams.length) return setError('Choose at least one team.')
    setBusy(true)
    try {
      const input = { ...draft, closeOn: draft.closeOn || null, testEmails }
      const result = await surveyCommand<{ id?: string }>(cycle ? { action: 'updateCycle', id: cycle.id, input } : { action: 'createCycle', input })
      onSaved(result.id)
      onOpenChange(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  const toggleTeam = (team: Team, on: boolean) => set('audienceTeams', TEAMS.filter((t) => t === team ? on : draft.audienceTeams.includes(t)))
  const num = (value: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)))

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{cycle ? (isTest ? 'Test run settings' : 'Survey settings') : isTest ? 'Start a test run' : 'Schedule a coaching survey'}</DialogTitle>
            <DialogDescription>
              {sent ? 'This survey has already gone out, so its send date is fixed. You can still move the due and close dates, change who gets it, and adjust reminders.' : 'On the send date the tracker emails every coach in the chosen teams, then sends reminders to anyone who has not responded. It uses the current question bank at that moment.'}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-title`}>Survey title</FieldLabel>
              <Input id={`${id}-title`} value={draft.title} maxLength={150} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <FieldGroup className="sm:flex-row">
              <Field>
                <FieldLabel htmlFor={`${id}-season`}>Season being reviewed</FieldLabel>
                <Input id={`${id}-season`} value={draft.seasonLabel} maxLength={40} onChange={(e) => set('seasonLabel', e.target.value)} />
                <FieldDescription>Replaces {'{season}'} in questions.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-next`}>Next season</FieldLabel>
                <Input id={`${id}-next`} value={draft.nextSeasonLabel} maxLength={40} onChange={(e) => set('nextSeasonLabel', e.target.value)} />
                <FieldDescription>Replaces {'{next_season}'} in questions.</FieldDescription>
              </Field>
            </FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-intro`}>Message to coaches</FieldLabel>
              <Textarea id={`${id}-intro`} value={draft.intro} rows={3} maxLength={2000} onChange={(e) => set('intro', e.target.value)} />
              <FieldDescription>Shown at the top of the survey and in the invitation email.</FieldDescription>
            </Field>
          </FieldGroup>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-semibold text-navy">Dates</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor={`${id}-send`}>Send on</FieldLabel>
                <Input id={`${id}-send`} type="date" value={draft.sendOn} disabled={sent} min={sent ? undefined : todayET()} onChange={(e) => set('sendOn', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-due`}>Due by</FieldLabel>
                <Input id={`${id}-due`} type="date" value={draft.dueOn} min={draft.sendOn} onChange={(e) => set('dueOn', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-close`}>Stop accepting (optional)</FieldLabel>
                <Input id={`${id}-close`} type="date" value={draft.closeOn} min={draft.dueOn} onChange={(e) => set('closeOn', e.target.value)} />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">Emails go out around 9 a.m. Eastern on each date. Leave &ldquo;Stop accepting&rdquo; blank to keep the survey open until the board closes it.</p>
          </fieldset>

          {isTest ? (
            <fieldset className="flex flex-col gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
              <legend className="px-1 text-base font-semibold text-amber-900">Test run: who gets it</legend>
              <p className="text-sm text-amber-950">Only these addresses get the survey, with &ldquo;[TEST]&rdquo; in the subject. No coach is emailed. Each person must sign in to the tracker with that address to fill it out. Delete the test afterwards to remove it and its answers.</p>
              <Field>
                <FieldLabel htmlFor={`${id}-test`}>Email addresses (one per line, up to 10)</FieldLabel>
                <Textarea id={`${id}-test`} rows={3} value={testText} onChange={(e) => setTestText(e.target.value)} />
              </Field>
            </fieldset>
          ) : (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-semibold text-navy">Who gets it</legend>
            <p className="text-sm text-muted-foreground">Every approved, active person on these teams, whatever their role or pay status. Coaches added later are included automatically while the survey is open.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEAMS.map((team) => (
                <label key={team} className="flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
                  <input type="checkbox" className="size-4 accent-brand" checked={draft.audienceTeams.includes(team)} onChange={(e) => toggleTeam(team, e.target.checked)} />
                  <span className="text-sm">{team}</span>
                </label>
              ))}
            </div>
          </fieldset>
          )}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-semibold text-navy">Reminders</legend>
            <p className="text-sm text-muted-foreground">Reminders only go to people who have not submitted, and stop the moment they do. Nobody gets more than one email a day.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-every`}>Remind every (days)</FieldLabel>
                <Input id={`${id}-every`} type="number" min={0} max={30} value={draft.reminderEveryDays} onChange={(e) => set('reminderEveryDays', num(e.target.value, 0, 30))} />
                <FieldDescription>0 turns regular reminders off.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-max`}>Most reminders per person</FieldLabel>
                <Input id={`${id}-max`} type="number" min={0} max={20} value={draft.maxReminders} onChange={(e) => set('maxReminders', num(e.target.value, 0, 20))} />
                <FieldDescription>The due-tomorrow reminder is extra.</FieldDescription>
              </Field>
            </div>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 accent-brand" checked={draft.remindDayBeforeDue} onChange={(e) => set('remindDayBeforeDue', e.target.checked)} />
              <span>Send a &ldquo;due tomorrow&rdquo; reminder the day before it&apos;s due</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 accent-brand" checked={draft.remindAfterDue} onChange={(e) => set('remindAfterDue', e.target.checked)} />
              <span>Keep reminding after the due date</span>
            </label>
            {draft.remindAfterDue && (
              <Field className="sm:max-w-xs">
                <FieldLabel htmlFor={`${id}-after`}>For how many days after</FieldLabel>
                <Input id={`${id}-after`} type="number" min={0} max={60} value={draft.afterDueDays} onChange={(e) => set('afterDueDays', num(e.target.value, 0, 60))} />
              </Field>
            )}
            {plan.length > 0 && (
              <div className="rounded-lg border bg-secondary/40 p-3">
                <p className="mb-2 text-sm font-medium">A coach who never responds would get:</p>
                <ol className="grid gap-1 text-sm sm:grid-cols-2">
                  {plan.map((p) => <li key={p.date}><span className="font-medium">{shortDate(p.date)}</span> · {KIND_TEXT[p.kind]}</li>)}
                </ol>
              </div>
            )}
          </fieldset>

          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => change(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : cycle ? 'Save settings' : 'Schedule survey'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
