'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { SummaryTiles, tileFilters, type TileFilter } from './summary-tiles'
import { CoachesTable } from './coaches-table'
import { TeamsOverview } from './teams-overview'
import { InProgressList } from './in-progress-list'
import { formatDate, readyToFloat, scopeSummary, TODAY } from '@/lib/compliance'
import { PROGRAMS, PROGRAM_LABELS, type Program } from '@/lib/types'
import Link from '@/components/app-link'

const filterLabels: Record<TileFilter, string> = {
  all: 'All coaches',
  cleared: 'Cleared to Coach',
  incomplete: 'Incomplete',
  expiring: 'Expiring in 60 Days',
  expired: 'Expired',
  pending: 'Awaiting Review',
  'in-progress': 'In Progress',
}

export function DashboardView() {
  const { summaries: allSummaries, awaitingCoaches, viewMode } = useApp()
  const [program, setProgram] = useState<Program | 'all'>('all')
  // A coach is only tracked in the program(s) they are assigned to.
  const summaries = program === 'all' ? allSummaries : allSummaries.flatMap((s) => scopeSummary(s, program) ?? [])
  const floaters = readyToFloat(allSummaries)
  const waiting = viewMode === 'board' ? awaitingCoaches.filter(c => c.status === 'pending').length : 0
  const [filter, setFilter] = useState<TileFilter>('all')
  const visible = filter === 'all' ? summaries : summaries.filter(tileFilters[filter])

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Coach compliance for the current season as of ${formatDate(TODAY)}.`}
      />
      {waiting > 0 && <a href="/review" className="mb-6 block rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm font-medium text-navy underline-offset-4 hover:underline">{waiting} coach {waiting === 1 ? 'profile is' : 'profiles are'} waiting for your approval. Review {waiting === 1 ? 'it' : 'them'} in the Review Queue.</a>}
      <Tabs defaultValue="coaches" className="gap-6">
        <TabsList className="h-10">
          <TabsTrigger value="coaches" className="px-4 text-base">Coaches Overview</TabsTrigger>
          <TabsTrigger value="teams" className="px-4 text-base">Teams Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="coaches" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Program">
            {(['all', ...PROGRAMS] as const).map((p) => (
              <button key={p} type="button" aria-pressed={program === p} onClick={() => { setProgram(p); setFilter('all') }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium ${program === p ? 'border-brand bg-brand text-white' : 'bg-card hover:bg-secondary/60'}`}>
                {p === 'all' ? 'All programs' : PROGRAM_LABELS[p]}
              </button>
            ))}
            <span className="text-sm text-muted-foreground">Coaches only count in the program(s) they are assigned to.</span>
          </div>
          <SummaryTiles summaries={summaries} active={filter} onChange={setFilter} />
          {(filter === 'all' || filter === 'in-progress') && <InProgressList summaries={summaries} />}
          {floaters.length > 0 && (
            <section className="rounded-xl border bg-card p-4" aria-label="Ready to float">
              <h2 className="text-lg font-semibold text-navy">Ready to float to youth ({floaters.length})</h2>
              <p className="text-sm text-muted-foreground">High school coaches who already meet every youth requirement.</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {floaters.map((f) => <li key={f.coach.id}><Link href={`/coaches/${f.coach.id}`} className="text-brand hover:underline">{f.coach.name}</Link> <span className="text-sm text-muted-foreground">({f.coach.team})</span></li>)}
              </ul>
            </section>
          )}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-navy" aria-live="polite">
                {filterLabels[filter]}{' '}
                <span className="font-normal text-muted-foreground">({visible.length})</span>
              </h2>
              {filter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            <CoachesTable summaries={visible} />
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <TeamsOverview summaries={summaries} />
        </TabsContent>
      </Tabs>
    </>
  )
}
