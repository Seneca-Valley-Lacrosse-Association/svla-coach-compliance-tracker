'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { SummaryTiles, tileFilters, type TileFilter } from './summary-tiles'
import { CoachesTable } from './coaches-table'
import { TeamsOverview } from './teams-overview'
import { formatDate, TODAY } from '@/lib/compliance'

const filterLabels: Record<TileFilter, string> = {
  all: 'All coaches',
  cleared: 'Cleared to Coach',
  incomplete: 'Incomplete',
  expiring: 'Expiring in 60 Days',
  expired: 'Expired',
  pending: 'Awaiting Review',
}

export function DashboardView() {
  const { summaries } = useApp()
  const [filter, setFilter] = useState<TileFilter>('all')
  const visible = filter === 'all' ? summaries : summaries.filter(tileFilters[filter])

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Coach compliance for the current season as of ${formatDate(TODAY)}.`}
      />
      <Tabs defaultValue="coaches" className="gap-6">
        <TabsList className="h-10">
          <TabsTrigger value="coaches" className="px-4 text-base">Coaches Overview</TabsTrigger>
          <TabsTrigger value="teams" className="px-4 text-base">Teams Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="coaches" className="flex flex-col gap-6">
          <SummaryTiles summaries={summaries} active={filter} onChange={setFilter} />
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
