'use client'

import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { badgeValidThrough } from '@/lib/compliance'
import { TEAMS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { PrintSheet } from './print-portal'

/** Board: print many badges at once. Only coaches cleared in at least one program can be printed. */
export function BadgesPage() {
  const { summaries, isDemo } = useApp()
  const [team, setTeam] = useState('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [printing, setPrinting] = useState(false)

  const rows = useMemo(
    () => summaries
      .filter((s) => (team === 'all' || s.coach.team === team) && !!s.coach.verifyToken)
      .sort((a, b) => a.coach.name.localeCompare(b.coach.name)),
    [summaries, team],
  )
  const printable = rows.filter((s) => badgeValidThrough(s) !== null)
  const chosen = printable.filter((s) => picked.has(s.coach.id))

  function toggle(id: string) { setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function selectAll() { setPicked(new Set(printable.map((s) => s.coach.id))) }
  function print() { setPrinting(true); setTimeout(() => window.print(), 100) }

  if (isDemo) return <p className="rounded-xl border bg-card p-6">Badges are not available in the demo.</p>

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Badges" description="Print coach badges in batches. Each page holds fold-over badges; cut and fold on the dashed line." />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="badge-team" className="text-sm font-medium">Team</label>
          <select id="badge-team" value={team} onChange={(e) => { setTeam(e.target.value); setPicked(new Set()) }} className="h-10 rounded-lg border border-input bg-card px-3 text-base">
            <option value="all">All teams</option>
            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Button variant="outline" onClick={selectAll} disabled={printable.length === 0} className="h-10 px-4">Select all ready ({printable.length})</Button>
        <Button variant="outline" onClick={() => setPicked(new Set())} disabled={picked.size === 0} className="h-10 px-4">Clear</Button>
        <Button onClick={print} disabled={chosen.length === 0} className="h-10 px-4"><Printer data-icon="inline-start" aria-hidden="true" />Print {chosen.length || ''} {chosen.length === 1 ? 'badge' : 'badges'}</Button>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {rows.map((s) => {
          const through = badgeValidThrough(s)
          const ready = through !== null
          return (
            <li key={s.coach.id} className="flex items-center gap-3 px-4 py-3">
              <input id={`b-${s.coach.id}`} type="checkbox" disabled={!ready} checked={picked.has(s.coach.id)} onChange={() => toggle(s.coach.id)} className="size-5" />
              <label htmlFor={`b-${s.coach.id}`} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{s.coach.name}</span>
                <span className="text-sm text-muted-foreground">{s.coach.team}</span>
              </label>
              <span className="text-sm text-muted-foreground">{ready ? `Valid through ${through}` : 'Not cleared in any program yet'}</span>
            </li>
          )
        })}
        {rows.length === 0 && <li className="px-4 py-6 text-muted-foreground">No coaches match.</li>}
      </ul>
      {printing && <PrintSheet summaries={chosen} onDone={() => setPrinting(false)} />}
    </div>
  )
}
