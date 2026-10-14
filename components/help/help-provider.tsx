'use client'

import { createContext, useContext, useId, useState, type FormEvent } from 'react'
import { usePathname } from 'next/navigation'
import { mutate as refreshTickets } from 'swr'
import { LifeBuoy } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { IT_EMAIL, MAX_TICKET_LENGTH, TICKET_TOPICS, type TicketTopic } from '@/lib/tickets'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

interface HelpRequest { topic?: TicketTopic; item?: string }
interface HelpApi { openHelp: (request?: HelpRequest) => void; enabled: boolean }
const HelpContext = createContext<HelpApi | null>(null)

/** Open the help form from anywhere in the app. Does nothing (and `enabled` is false) in the read-only demo. */
export function useHelp(): HelpApi {
  return useContext(HelpContext) ?? { openHelp: () => {}, enabled: false }
}

const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-brand'

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const { isDemo, getSummary, currentCoachId } = useApp()
  const pathname = usePathname()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState<TicketTopic | ''>('')
  const [item, setItem] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ topic?: string; description?: string }>({})
  const [sent, setSent] = useState<{ ticketCode: string; notified: boolean; confirmed: boolean } | null>(null)

  function reset() {
    setTopic(''); setItem(''); setDescription(''); setError(''); setFieldErrors({}); setSent(null)
  }
  function changeOpen(value: boolean) {
    setOpen(value)
    if (!value) reset()
  }
  function openHelp(request?: HelpRequest) {
    if (isDemo) return
    reset()
    setTopic(request?.topic ?? '')
    setItem(request?.item ?? '')
    setOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const next: typeof fieldErrors = {}
    if (!topic) next.topic = 'Choose what you need help with.'
    if (!description.trim()) next.description = 'Tell us what is happening.'
    setFieldErrors(next)
    if (next.topic || next.description) {
      document.getElementById(`${id}-${next.topic ? 'topic' : 'description'}`)?.focus()
      return
    }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SVLA-Request': '1' },
        body: JSON.stringify({
          topic,
          description,
          context: {
            page: pathname,
            item: item || undefined,
            team: getSummary(currentCoachId)?.coach.team,
            browser: typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 200),
          },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not send your request.')
      setSent({ ticketCode: result.ticketCode, notified: !!result.notified, confirmed: !!result.confirmed })
      void refreshTickets('/api/tickets')
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not send your request. Please email ${IT_EMAIL}.`)
    } finally { setBusy(false) }
  }

  return (
    <HelpContext.Provider value={{ openHelp, enabled: !isDemo }}>
      {children}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {sent ? (
            <>
              <DialogHeader>
                <DialogTitle>Request sent</DialogTitle>
                <DialogDescription>Your ticket ID is <strong>{sent.ticketCode}</strong>. Keep it handy if you write to us about this request.</DialogDescription>
              </DialogHeader>
              {!sent.notified
                ? <p role="alert" className="rounded-lg bg-orange-50 p-3 text-sm leading-relaxed text-orange-900">Your request is saved, but we could not email IT automatically. Please also email <a className="font-medium underline" href={`mailto:${IT_EMAIL}?subject=${encodeURIComponent(`Help request ${sent.ticketCode}`)}`}>{IT_EMAIL}</a> and include {sent.ticketCode}.</p>
                : <p className="text-sm leading-relaxed text-muted-foreground">{sent.confirmed ? 'We emailed you a confirmation. Our IT team will follow up by email.' : 'IT has your request and will follow up by email. We could not send you a confirmation message.'}</p>}
              <DialogFooter><Button type="button" onClick={() => changeOpen(false)}>Done</Button></DialogFooter>
            </>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-5">
              <DialogHeader>
                <DialogTitle>Need help?</DialogTitle>
                <DialogDescription>Tell us what is going on and our IT team will email you back. Please do not include Social Security numbers or copies of your clearance documents here.</DialogDescription>
              </DialogHeader>
              <FieldGroup>
                {item && (
                  <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">About:</span> {item}
                  </p>
                )}
                <Field data-invalid={!!fieldErrors.topic}>
                  <FieldLabel htmlFor={`${id}-topic`}>What do you need help with?</FieldLabel>
                  <select id={`${id}-topic`} className={selectClass} value={topic} onChange={(e) => setTopic(e.target.value as TicketTopic | '')} aria-invalid={!!fieldErrors.topic} required>
                    <option value="">Choose a topic…</option>
                    {TICKET_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {fieldErrors.topic && <FieldError>{fieldErrors.topic}</FieldError>}
                </Field>
                <Field data-invalid={!!fieldErrors.description}>
                  <FieldLabel htmlFor={`${id}-description`}>What is happening?</FieldLabel>
                  <Textarea id={`${id}-description`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={MAX_TICKET_LENGTH} rows={5} aria-invalid={!!fieldErrors.description} aria-describedby={`${id}-count`} />
                  <FieldDescription id={`${id}-count`}>{description.length.toLocaleString()} / {MAX_TICKET_LENGTH.toLocaleString()} characters</FieldDescription>
                  {fieldErrors.description && <FieldError>{fieldErrors.description}</FieldError>}
                </Field>
              </FieldGroup>
              {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </HelpContext.Provider>
  )
}

/** The header button. Renders nothing in the demo. */
export function HelpButton() {
  const { openHelp, enabled } = useHelp()
  if (!enabled) return null
  return (
    <button
      type="button"
      onClick={() => openHelp()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-brand-light"
    >
      <LifeBuoy className="size-4" aria-hidden="true" />
      <span className="sm:hidden">Help</span>
      <span className="hidden sm:inline">Need help?</span>
    </button>
  )
}
