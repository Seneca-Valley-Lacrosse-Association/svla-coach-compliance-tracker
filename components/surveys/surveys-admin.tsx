'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/app-link'
import { CalendarClock, Plus } from 'lucide-react'
import { useSurveys } from '@/lib/use-surveys'
import { cycleCounts, shortDate, type SurveyCycle } from '@/lib/surveys'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { RequirementProgress } from '@/components/requirement-progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CycleDialog } from './cycle-dialog'
import { QuestionBank } from './question-bank'

export function StatusPill({ cycle }: { cycle: SurveyCycle }) {
  const [text, cls] = cycle.isHistorical ? ['Imported', 'bg-slate-100 text-slate-800']
    : cycle.status === 'scheduled' ? ['Scheduled', 'bg-sky-100 text-sky-900']
    : cycle.status === 'open' ? ['Open', 'bg-emerald-100 text-emerald-900']
    : ['Closed', 'bg-slate-200 text-slate-800']
  return <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${cls}`}>{text}</span>
}

export function SurveysAdmin() {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSurveys()
  const [creating, setCreating] = useState(false)
  if (isLoading) return <p role="status">Loading surveys…</p>
  if (error || data?.role !== 'board') return <p role="alert">Coaching surveys could not be loaded. Board access is required.</p>
  const cycles = data.cycles ?? []
  const assignments = data.assignments ?? []

  return (
    <>
      <PageHeader
        title="Coach Surveys"
        description="Schedule the annual coaching survey, follow responses, and build the board report. Board only."
        actions={<Button className="h-10 px-4" onClick={() => setCreating(true)}><Plus aria-hidden="true" />Schedule a survey</Button>}
      />
      <Tabs defaultValue="surveys" className="gap-6">
        <TabsList className="h-10">
          <TabsTrigger value="surveys" className="px-4 text-base">Surveys</TabsTrigger>
          <TabsTrigger value="questions" className="px-4 text-base">Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="surveys">
          {cycles.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-muted-foreground">No surveys yet. Use &ldquo;Schedule a survey&rdquo; to pick a send date.</div>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {cycles.map((c) => {
                const counts = cycleCounts(assignments.filter((a) => a.cycleId === c.id))
                return (
                  <li key={c.id}>
                    <Link href={`/surveys/${c.id}`} className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs hover:border-brand focus-visible:outline-2 focus-visible:outline-brand">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg font-semibold text-navy">{c.title}</h2>
                        <StatusPill cycle={c} />
                      </div>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock className="size-4" aria-hidden="true" />
                        {c.isHistorical ? `Imported responses from the ${c.seasonLabel} season` : `${c.status === 'scheduled' ? 'Sends' : 'Sent'} ${shortDate(c.sendOn)} · due ${shortDate(c.dueOn)}${c.closeOn ? ` · closes ${shortDate(c.closeOn)}` : ''}`}
                      </p>
                      {c.status === 'scheduled' && !c.isHistorical
                        ? <p className="text-sm">Goes to {c.audienceTeams.length} team{c.audienceTeams.length === 1 ? '' : 's'}. Reminders every {c.reminderEveryDays || '—'} days.</p>
                        : (
                          <div>
                            <p className="mb-1 text-sm font-medium">{counts.submitted} of {counts.total} responded{counts.started ? ` · ${counts.started} in progress` : ''}</p>
                            <RequirementProgress done={counts.submitted} total={Math.max(counts.total, 1)} showLabel={false} />
                          </div>
                        )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="questions">
          <QuestionBank questions={data.questions ?? []} onChanged={() => mutate()} />
        </TabsContent>
      </Tabs>
      <CycleDialog open={creating} onOpenChange={setCreating} onSaved={(id) => { void mutate(); if (id) router.push(`/surveys/${id}`) }} />
    </>
  )
}
