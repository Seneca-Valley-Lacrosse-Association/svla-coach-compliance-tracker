'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

function summary(selected: string[], total: number) {
  if (selected.length === 0) return 'No teams'
  if (selected.length === total) return 'All my teams'
  if (selected.length <= 2) return selected.join(', ')
  return `${selected.length} teams`
}

/**
 * Checkbox dropdown for choosing which teams to show. `selected` is the list of checked teams; the parent
 * decides what "everything checked" means (here: the default). "Select all" checks or clears every team.
 */
export function TeamPicker({ teams, selected, onChange }: { teams: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const allRef = useRef<HTMLInputElement>(null)
  const allChecked = selected.length === teams.length
  const none = selected.length === 0

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = !allChecked && !none
  }, [allChecked, none, open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = (team: string) => onChange(teams.filter((t) => (t === team ? !selected.includes(t) : selected.includes(t))))

  return (
    <div ref={root} className="relative flex items-center gap-2 text-sm">
      <span id="team-picker-label" className="text-muted-foreground">Team</span>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby="team-picker-label team-picker-value"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 min-w-44 items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span id="team-picker-value" className="truncate">{summary(selected, teams.length)}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && (
        <div role="group" aria-label="Choose teams" className="absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border bg-card p-2 shadow-lg">
          <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-base font-medium hover:bg-muted">
            <input
              ref={allRef}
              type="checkbox"
              checked={allChecked}
              onChange={() => onChange(allChecked ? [] : teams)}
              className="size-4 accent-brand"
            />
            Select all
          </label>
          <div className="my-1 border-t" />
          <ul className="max-h-64 overflow-y-auto">
            {teams.map((team) => (
              <li key={team}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-base hover:bg-muted">
                  <input type="checkbox" checked={selected.includes(team)} onChange={() => toggle(team)} className="size-4 accent-brand" />
                  {team}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
