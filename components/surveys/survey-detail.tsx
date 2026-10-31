'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/app-link'
import { ArrowLeft, Download, FileText, Lock, LockOpen, Mail, Settings, Trash2 } from 'lucide-react'
import { useSurveys, surveyCommand } from '@/lib/use-surveys'
import { buildReport, parseSummary, topicLabel } from '@/lib/survey-report'
import { PROGRAMS, PROGRAM_LABELS } from '@/lib/types'
import { answerText, cycleCounts, fillLabel, isVisible, longDate, programOf, shortDate, teamLabel, type SurveyAssignment, type SurveyCycle } from '@/lib/surveys'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CycleDialog } from './cycle-dialog'
import { StatusPill } from './surveys-admin'

export function SurveyDetail({ id }: { id: string }) {
  const { data, error, isLoading, mutate } = useSurveys()
  if (isLoading) return <p role="status">Loading survey…</p>
  if (error || data?.role !== 'board') return <p role="alert">This survey could not be loaded. Board access is required.</p>
  const cycle = data.cycles?.find((c) => c.id === id)
  if (!cycle) return <p role="alert">Survey not found. <Link className="text-primary underline" href="/surveys">Back to Coach Surveys</Link></p>
  return <Detail cycle={cycle} assignments={(data.assignments ?? []).filter((a) => a.cycleId === id)} refresh={() => mutate()} />
}

function Detail({ cycle, assignments, refresh }: { cycle: SurveyCycle; assignments: SurveyAssignment[]; refresh: () => void }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const report = useMemo(() => buildReport(cycle, assignments), [cycle, assignments])
  const counts = cycleCounts(assignments)
  const scheduled = cycle.status === 'scheduled'

  async function run(label: string, command: Record<string, unknown>, done?: (r: Record<string, unknown>) => string) {
    if (busy) return
    setBusy(label); setNotice(''); setFailure('')
    try {
      const result = await surveyCommand(command)
      if (done) setNotice(done(result))
      refresh()
      return result
    } catch (e) { setFailure(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy('') }
  }

  const sendNow = () => {
    const question = scheduled
      ? `Send "${cycle.title}" to everyone now instead of on ${longDate(cycle.sendOn)}?`
      : `Send a reminder now to the ${counts.outstanding} ${counts.outstanding === 1 ? 'person who has' : 'people who have'} not responded? (Anyone already emailed today is skipped.)`
    if (!window.confirm(question)) return
    void run('send', { action: 'sendNow', id: cycle.id }, (r) => {
      const sent = (r.result ?? {}) as { sent?: Record<string, number>; failed?: number }
      const total = Object.values(sent.sent ?? {}).reduce((n, v) => n + v, 0)
      return `${total} email${total === 1 ? '' : 's'} sent${sent.failed ? `, ${sent.failed} failed (they will be retried tomorrow)` : ''}.`
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/surveys" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />Coach Surveys</Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-navy text-balance lg:text-3xl">{cycle.title}</h1>
            <StatusPill cycle={cycle} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {cycle.isHistorical
              ? `Imported from the ${cycle.seasonLabel} survey · ${counts.submitted} responses`
              : `${scheduled ? 'Sends' : 'Sent'} ${longDate(cycle.sendOn)} · due ${longDate(cycle.dueOn)}${cycle.closeOn ? ` · stops accepting ${longDate(cycle.closeOn)}` : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!cycle.isHistorical && cycle.status !== 'closed' && <Button className="h-10 px-4" disabled={!!busy} onClick={sendNow}><Mail aria-hidden="true" />{busy === 'send' ? 'Sending…' : scheduled ? 'Send now' : 'Send reminder now'}</Button>}
          {!cycle.isHistorical && <Button variant="outline" className="h-10 bg-card px-4" onClick={() => setEditing(true)}><Settings aria-hidden="true" />Settings</Button>}
          {!cycle.isHistorical && cycle.status === 'open' && <Button variant="outline" className="h-10 bg-card px-4" disabled={!!busy} onClick={() => { if (window.confirm('Close this survey? Coaches will no longer be able to respond and reminders stop. You can reopen it later.')) void run('status', { action: 'setCycleStatus', id: cycle.id, status: 'closed' }, () => 'Survey closed.') }}><Lock aria-hidden="true" />Close survey</Button>}
          {!cycle.isHistorical && cycle.status === 'closed' && <Button variant="outline" className="h-10 bg-card px-4" disabled={!!busy} onClick={() => void run('status', { action: 'setCycleStatus', id: cycle.id, status: 'open' }, () => 'Survey reopened. Reminders resume on the next daily run if the reminder window allows.')}><LockOpen aria-hidden="true" />Reopen</Button>}
          <Button variant="outline" className="h-10 bg-card px-4" disabled={scheduled} render={<a href={`/api/surveys/${cycle.id}/export?format=pdf`} download />}><FileText aria-hidden="true" />Board report (PDF)</Button>
          <Button variant="outline" className="h-10 bg-card px-4" disabled={scheduled} render={<a href={`/api/surveys/${cycle.id}/export?format=xlsx`} download />}><Download aria-hidden="true" />Excel</Button>
        </div>
      </div>
      {notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 font-medium text-emerald-900">{notice}</p>}
      {failure && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 font-medium text-destructive">{failure}</p>}

      {scheduled ? <ScheduledView cycle={cycle} onDelete={() => void run('delete', { action: 'deleteCycle', id: cycle.id }).then((r) => { if (r) router.push('/surveys') })} /> : (
        <Tabs defaultValue="overview" className="gap-6">
          <TabsList className="h-10">
            <TabsTrigger value="overview" className="px-4 text-base">Overview</TabsTrigger>
            <TabsTrigger value="responses" className="px-4 text-base">Responses</TabsTrigger>
            <TabsTrigger value="summary" className="px-4 text-base">Board summary</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="flex flex-col gap-6">
            <Tiles cycle={cycle} counts={counts} />
            <section aria-labelledby="glance" className="flex flex-col gap-3">
              <h2 id="glance" className="text-lg font-semibold text-navy">At a glance</h2>
              <dl className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
                {report.glance.map((g) => (
                  <div key={g.label} className="grid gap-1 p-3 sm:grid-cols-[18rem_1fr] sm:gap-4">
                    <dt className="font-medium">{g.label}</dt>
                    <dd>{g.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <RosterTable report={report} />
            {!cycle.isHistorical && <Outstanding assignments={report.outstanding} busy={busy} onRemove={(a) => { if (window.confirm(`Stop sending this survey to ${a.coachName}? They will no longer see it or get reminders.`)) void run('remove', { action: 'removeAssignment', id: a.id }, () => `${a.coachName} removed from this survey.`) }} />}
            {!cycle.isHistorical && cycle.status !== 'closed' && <p className="text-sm text-muted-foreground">Reminders: every {cycle.reminderEveryDays || '—'} days, up to {cycle.maxReminders} per person{cycle.remindDayBeforeDue ? ', plus one the day before it is due' : ''}{cycle.remindAfterDue ? `, continuing ${cycle.afterDueDays} days past the due date` : ''}. Change these under Settings.</p>}
          </TabsContent>
          <TabsContent value="responses"><Responses cycle={cycle} report={report} /></TabsContent>
          <TabsContent value="summary"><SummaryEditor cycle={cycle} onSaved={refresh} /></TabsContent>
        </Tabs>
      )}
      {editing && <CycleDialog open onOpenChange={(o) => { if (!o) setEditing(false) }} cycle={cycle} onSaved={() => { refresh(); setNotice('Settings saved.') }} />}
    </div>
  )
}

function ScheduledView({ cycle, onDelete }: { cycle: SurveyCycle; onDelete: () => void }) {
  return (
    <section className="flex max-w-3xl flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      <h2 className="text-lg font-semibold text-navy">Waiting to send</h2>
      <p className="leading-relaxed">On <strong>{longDate(cycle.sendOn)}</strong>, around 9 a.m. Eastern, every approved, active person on {cycle.audienceTeams.join(', ')} will get the survey by email, using the questions in the question bank at that moment. You can change the dates and settings until then, or use &ldquo;Send now&rdquo;.</p>
      {cycle.intro && <p className="whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 text-sm">{cycle.intro}</p>}
      <div><Button variant="destructive" className="h-10 px-4" onClick={() => { if (window.confirm('Delete this scheduled survey? Nothing has been sent yet.')) onDelete() }}><Trash2 aria-hidden="true" />Delete survey</Button></div>
    </section>
  )
}

function Tiles({ cycle, counts }: { cycle: SurveyCycle; counts: ReturnType<typeof cycleCounts> }) {
  const tiles = cycle.isHistorical
    ? [['Responses', counts.submitted]]
    : [['Sent to', counts.total], ['Responded', counts.submitted], ['In progress', counts.started], ['Not started', counts.outstanding - counts.started]]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold text-navy">{value}</p>
        </div>
      ))}
      {!cycle.isHistorical && counts.failed > 0 && <p role="alert" className="col-span-full text-sm font-medium text-destructive">{counts.failed} invitation email{counts.failed === 1 ? '' : 's'} could not be delivered. They are retried on each daily run.</p>}
    </div>
  )
}

function RosterTable({ report }: { report: ReturnType<typeof buildReport> }) {
  return (
    <section aria-labelledby="roster" className="flex flex-col gap-3">
      <h2 id="roster" className="text-lg font-semibold text-navy">Coach roster and {report.cycle.nextSeasonLabel} intentions</h2>
      {report.roster.length === 0 ? <p className="text-muted-foreground">No responses yet.</p> : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-navy text-white">
              <tr>{['Coach', `${report.cycle.seasonLabel} team(s)`, report.cycle.nextSeasonLabel, 'Fall Ball', 'Years', 'USA Lacrosse', 'Email', 'Notes'].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {report.roster.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="align-top even:bg-secondary/30">
                  <th scope="row" className="px-3 py-2 font-semibold">{r.name}</th>
                  <td className="px-3 py-2">{r.team}</td>
                  <td className={`px-3 py-2 ${r.returning === 'Not interested' ? 'font-semibold text-amber-800' : ''}`}>{r.returning}</td>
                  <td className="px-3 py-2">{r.fallBall}</td>
                  <td className="px-3 py-2">{r.years}</td>
                  <td className="px-3 py-2">{r.certification}</td>
                  <td className="px-3 py-2 break-all">{r.email}</td>
                  <td className="px-3 py-2">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Outstanding({ assignments, busy, onRemove }: { assignments: SurveyAssignment[]; busy: string; onRemove: (a: SurveyAssignment) => void }) {
  if (!assignments.length) return <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-medium text-emerald-900">Everyone has responded.</p>
  return (
    <section aria-labelledby="outstanding" className="flex flex-col gap-3">
      <h2 id="outstanding" className="text-lg font-semibold text-navy">Not yet responded ({assignments.length})</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {assignments.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.coachName} <span className="font-normal text-muted-foreground">· {teamLabel(a.team)}</span></p>
              <p className="text-sm text-muted-foreground">
                {a.inviteFailed ? 'Invitation could not be delivered; retrying daily.' : a.invitedAt ? `Invited ${shortDate(a.invitedAt.slice(0, 10))} · ${a.remindersSent} reminder${a.remindersSent === 1 ? '' : 's'} sent${a.lastEmailedOn ? ` · last email ${shortDate(a.lastEmailedOn)}` : ''}` : 'Invitation goes out on the next run.'}
                {a.startedAt ? ' · Started, not submitted' : ''}
              </p>
            </div>
            <Button variant="ghost" className="h-9 self-start px-3 text-destructive sm:self-auto" disabled={!!busy} onClick={() => onRemove(a)}>Remove from survey</Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Responses({ cycle, report }: { cycle: SurveyCycle; report: ReturnType<typeof buildReport> }) {
  const [mode, setMode] = useState<'coach' | 'question'>('coach')
  const [program, setProgram] = useState<'all' | (typeof PROGRAMS)[number]>('all')
  const people = report.responded.filter((a) => program === 'all' || programOf(a.team) === program)
  if (!report.responded.length) return <p className="text-muted-foreground">No responses yet.</p>
  const pill = (active: boolean) => `rounded-full border px-4 py-1.5 text-sm font-medium ${active ? 'border-brand bg-brand text-white' : 'bg-card hover:bg-secondary/60'}`
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="flex gap-2">
          <button type="button" aria-pressed={mode === 'coach'} className={pill(mode === 'coach')} onClick={() => setMode('coach')}>By coach</button>
          <button type="button" aria-pressed={mode === 'question'} className={pill(mode === 'question')} onClick={() => setMode('question')}>By question</button>
        </div>
        <span className="mx-2 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <div role="group" aria-label="Program" className="flex flex-wrap gap-2">
          {(['all', ...PROGRAMS] as const).map((p) => <button key={p} type="button" aria-pressed={program === p} className={pill(program === p)} onClick={() => setProgram(p)}>{p === 'all' ? 'All programs' : PROGRAM_LABELS[p]}</button>)}
        </div>
      </div>
      {mode === 'coach' ? (
        <div className="flex flex-col gap-3">
          {people.map((a) => (
            <details key={a.id} className="group rounded-xl border bg-card shadow-xs">
              <summary className="flex cursor-pointer list-none flex-col gap-0.5 p-4 marker:hidden">
                <span className="font-semibold text-navy">{a.coachName}</span>
                <span className="text-sm text-brand">{report.cards.find((c) => c.name === a.coachName)?.meta}</span>
                <span className="text-sm text-muted-foreground">Submitted {shortDate(a.submittedAt!.slice(0, 10))} · <span className="group-open:hidden">Show answers</span><span className="hidden group-open:inline">Hide answers</span></span>
              </summary>
              <dl className="divide-y border-t">
                {report.questions.filter((q) => isVisible(q, a.answers)).map((q) => (
                  <div key={q.key} className="grid gap-1 p-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                    <dt className="text-sm font-medium">{topicLabel(q, cycle)}</dt>
                    <dd className="whitespace-pre-wrap">{answerText(a.answers[q.key]) || <span className="text-muted-foreground">No answer</span>}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {report.questions.map((q) => {
            const rows = people.filter((a) => isVisible(q, a.answers) && answerText(a.answers[q.key]))
            return (
              <section key={q.key} className="rounded-xl border bg-card shadow-xs">
                <h3 className="border-b p-4 font-semibold text-navy">{fillLabel(q.label, cycle)}</h3>
                {rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No answers.</p> : (
                  <ul className="divide-y">
                    {rows.map((a) => (
                      <li key={a.id} className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                        <span className="text-sm font-medium">{a.coachName}<span className="block font-normal text-muted-foreground">{teamLabel(a.team)}</span></span>
                        <span className="whitespace-pre-wrap">{answerText(a.answers[q.key])}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SummaryEditor({ cycle, onSaved }: { cycle: SurveyCycle; onSaved: () => void }) {
  const [themes, setThemes] = useState(cycle.summaryThemes)
  const [followUp, setFollowUp] = useState(cycle.summaryFollowUp)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const dirty = themes !== cycle.summaryThemes || followUp !== cycle.summaryFollowUp

  async function save() {
    setBusy(true); setStatus('')
    try { await surveyCommand({ action: 'saveSummary', id: cycle.id, themes, followUp }); setStatus('Saved. The board report now includes these sections.'); onSaved() }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-5">
        <p className="rounded-xl border bg-sky-50 p-4 text-sm leading-relaxed text-navy">Write the board&apos;s read of the responses here. Both sections appear in the PDF board report under the At a Glance table. Start a line with <strong>-</strong> for a bullet, and wrap words in <strong>**double asterisks**</strong> to make them bold, for example: <code>- **Youth operations need work.** Coaches reported…</code></p>
        <div className="flex flex-col gap-2">
          <label htmlFor="themes" className="font-semibold text-navy">What coaches told us</label>
          <Textarea id="themes" rows={14} value={themes} maxLength={20000} onChange={(e) => setThemes(e.target.value)} className="text-base" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="follow" className="font-semibold text-navy">Items for follow-up</label>
          <Textarea id="follow" rows={10} value={followUp} maxLength={20000} onChange={(e) => setFollowUp(e.target.value)} className="text-base" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="h-10 px-5" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Saving…' : 'Save summary'}</Button>
          {status && <p role="status" className="text-sm">{status}</p>}
          {cycle.summaryUpdatedAt && !status && <p className="text-sm text-muted-foreground">Last saved {new Date(cycle.summaryUpdatedAt).toLocaleString()} by {cycle.summaryUpdatedBy}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-navy">Preview</h2>
        <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-xs">
          <Preview title="What Coaches Told Us" text={themes} />
          <Preview title="Items for Follow-Up" text={followUp} />
        </div>
      </div>
    </div>
  )
}

function Preview({ title, text }: { title: string; text: string }) {
  const blocks = parseSummary(text)
  return (
    <section>
      <h3 className="mb-2 font-serif text-xl font-bold text-navy">{title}</h3>
      {blocks.length === 0 ? <p className="text-sm text-muted-foreground">Nothing written yet. This section is left out of the report until it has text.</p> : (
        <div className="flex flex-col gap-2 leading-relaxed">
          {blocks.map((b, i) => {
            const body = b.parts.map((p, j) => p.bold ? <strong key={j}>{p.text}</strong> : <span key={j}>{p.text}</span>)
            return b.type === 'bullet' ? <p key={i} className="relative pl-5 before:absolute before:left-1 before:content-['•']">{body}</p> : <p key={i}>{body}</p>
          })}
        </div>
      )}
    </section>
  )
}
