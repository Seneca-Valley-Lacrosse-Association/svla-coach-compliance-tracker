'use client'

import { useEffect, useMemo, useState } from 'react'
import { mutate as refreshTickets } from 'swr'
import { useApp } from '@/lib/app-store'
import { useTickets } from '@/lib/use-tickets'
import { IT_EMAIL, TICKET_STATUSES, statusLabel, topicLabel, type AdminTicket, type TicketStatus } from '@/lib/tickets'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/page-header'

const selectClass = 'h-10 rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-brand'
const tone: Record<TicketStatus, string> = {
  open: 'bg-slate-100 text-slate-700 ring-slate-200',
  in_progress: 'bg-sky-50 text-brand ring-sky-200',
  resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  bug_issue: 'bg-orange-50 text-orange-900 ring-orange-200',
}
type Filter = 'unresolved' | 'all' | TicketStatus
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET'

function TicketCard({ ticket }: { ticket: AdminTicket }) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [note, setNote] = useState(ticket.admin_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const alreadyFlagged = !!ticket.flagged_at
  const willAlert = status === 'bug_issue' && !alreadyFlagged
  const dirty = status !== ticket.status || note.trim() !== (ticket.admin_notes ?? '')
  const ctx = Object.entries({ Page: ticket.page_context?.page, Item: ticket.page_context?.item, Team: ticket.page_context?.team, Browser: ticket.page_context?.browser }).filter(([, v]) => v)

  async function save() {
    if (busy || !dirty) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-SVLA-Request': '1' },
        body: JSON.stringify({ id: ticket.id, ...(status !== ticket.status ? { status } : {}), note }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save.')
      setMessage(result.bugAlertSent === true ? `Saved. ${IT_EMAIL} was emailed about this bug.` : result.bugAlertSent === false ? `Saved, but the email to ${IT_EMAIL} did not go out. Please email IT about ${ticket.ticket_code} directly.` : 'Saved.')
      await refreshTickets('/api/tickets')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <li id={`ticket-${ticket.id}`} className="flex scroll-mt-24 flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-navy">{ticket.ticket_code}</h2>
        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset', tone[ticket.status])}>{statusLabel(ticket.status)}</span>
        <span className="text-sm text-muted-foreground">{topicLabel(ticket.topic)}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        From <span className="font-medium text-foreground">{ticket.coach_name}</span> (<a className="text-primary underline underline-offset-4" href={`mailto:${ticket.coach_email}?subject=${encodeURIComponent(`Re: ${ticket.ticket_code}`)}`}>{ticket.coach_email}</a>) · {when(ticket.created_at)}
      </p>
      <p className="whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
      {ctx.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {ctx.map(([k, v]) => <div key={k} className="min-w-0"><dt className="inline text-muted-foreground">{k}: </dt><dd className="inline break-words font-medium">{v}</dd></div>)}
        </dl>
      )}
      {alreadyFlagged && <p className="text-sm text-muted-foreground">Flagged Bug / Issue by {ticket.flagged_by_email ?? 'a board member'} on {when(ticket.flagged_at!)}. Coaches see this ticket as In Progress.</p>}
      <div className="flex flex-col gap-3 border-t pt-4">
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor={`status-${ticket.id}`} className="text-sm font-medium">Status</label>
          <select id={`status-${ticket.id}`} className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
            {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`note-${ticket.id}`} className="text-sm font-medium">Internal note <span className="font-normal text-muted-foreground">(never shown to the coach{willAlert ? `; included in the email to ${IT_EMAIL}` : ''})</span></label>
          <Textarea id={`note-${ticket.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} />
        </div>
        {willAlert && <p className="rounded-lg bg-orange-50 p-3 text-sm leading-relaxed text-orange-900">Saving will email {IT_EMAIL} once so they can look into this. The email includes the description and page details but not the coach&apos;s name or email.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : willAlert ? 'Save and notify IT' : 'Save'}</Button>
          <p role="status" className={message ? 'text-sm text-muted-foreground' : 'sr-only'}>{message}</p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </li>
  )
}

export function TicketsAdminView() {
  const { viewMode } = useApp()
  const { data, error, isLoading } = useTickets()
  const [filter, setFilter] = useState<Filter>('unresolved')
  const target = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('ticket') ?? ''
  const tickets = data?.admin ?? []
  const shown = useMemo(() => tickets.filter((t) => filter === 'all' ? true : filter === 'unresolved' ? t.status !== 'resolved' : t.status === filter), [tickets, filter])

  // A link from an email opens that ticket: show everything, then scroll to it.
  useEffect(() => { if (target) setFilter('all') }, [target])
  useEffect(() => {
    if (!target || tickets.length === 0) return
    document.getElementById(`ticket-${target}`)?.scrollIntoView({ block: 'start' })
  }, [target, tickets.length])

  if (viewMode !== 'board') return <p className="text-muted-foreground">Help requests are managed by the board.</p>
  return (
    <>
      <PageHeader
        title="Help Requests"
        description={`Requests sent with the Need help? button. All of them are emailed to ${IT_EMAIL}. Flag a real bug as Bug / Issue to alert IT.`}
        actions={
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ticket-filter" className="text-sm font-medium">Show</label>
            <select id="ticket-filter" className={selectClass} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="unresolved">Not resolved</option>
              <option value="all">All requests</option>
              {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label} only</option>)}
            </select>
          </div>
        }
      />
      {isLoading && <p role="status" className="text-muted-foreground">Loading help requests…</p>}
      {error && <p role="alert" className="text-destructive">Unable to load help requests. Please refresh.</p>}
      {!isLoading && !error && shown.length === 0 && (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">{tickets.length === 0 ? 'No help requests yet.' : 'No requests match this filter.'}</p>
      )}
      <ul className="flex flex-col gap-4">
        {shown.map((t) => <TicketCard key={`${t.id}-${t.status}-${t.admin_notes ?? ''}`} ticket={t} />)}
      </ul>
    </>
  )
}
