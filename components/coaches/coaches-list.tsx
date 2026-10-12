'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { PAY_STATUSES, TEAMS } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'
import { CoachesTable } from '@/components/dashboard/coaches-table'
import { AddCoachDialog } from './add-coach-dialog'
import { PendingAccounts } from './pending-accounts'
import { AwaitingApproval } from './awaiting-approval'

const selectClass =
  'h-10 rounded-lg border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-brand'

export function CoachesList() {
  const { summaries } = useApp()
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('all')
  const [pay, setPay] = useState('all')
  const [addedName, setAddedName] = useState('')

  const q = query.trim().toLowerCase()
  const visible = summaries.filter(
    (s) =>
      (!q || s.coach.name.toLowerCase().includes(q) || s.coach.email.toLowerCase().includes(q)) &&
      (team === 'all' || s.coach.team === team) &&
      (pay === 'all' || s.coach.pay === pay),
  )

  return (
    <>
      <PageHeader
        title="Coaches"
        description={`${summaries.length} coaches on staff this season.`}
        actions={<AddCoachDialog onAdded={(name) => {
          setQuery('')
          setTeam('all')
          setPay('all')
          setAddedName(name)
        }} />}
      />
      <p role="status" className={addedName ? 'mb-4 text-sm text-muted-foreground' : 'sr-only'}>
        {addedName && `${addedName} added to the roster. Their requirements checklist is ready.`}
      </p>
      <AwaitingApproval />
      <PendingAccounts onAdded={(name) => { setQuery(''); setTeam('all'); setPay('all'); setAddedName(name) }} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="coach-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="coach-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or email"
              className="h-10 bg-card pl-9 text-base"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-filter">Team</Label>
            <select id="team-filter" value={team} onChange={(e) => setTeam(e.target.value)} className={selectClass}>
              <option value="all">All teams</option>
              {TEAMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-filter">Pay status</Label>
            <select id="pay-filter" value={pay} onChange={(e) => setPay(e.target.value)} className={selectClass}>
              <option value="all">All</option>
              {PAY_STATUSES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <CoachesTable summaries={visible} />
    </>
  )
}
