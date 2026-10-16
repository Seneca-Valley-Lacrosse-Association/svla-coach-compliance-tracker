'use client'

import { useState } from 'react'
import { UserMinus, UserPlus } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { TEAMS, type AccessLevel, type Team } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'

const LEVEL_LABELS: Record<AccessLevel, string> = { none: 'No access', view: 'View only', manage: 'View and manage' }
const rank = (l: AccessLevel) => (l === 'manage' ? 2 : l === 'view' ? 1 : 0)
const selectClass = 'h-10 w-full rounded-lg border border-input bg-card px-3 text-base'

function TeamPicker({ value, onChange, idPrefix }: { value: Team[]; onChange: (teams: Team[]) => void; idPrefix: string }) {
  return (
    <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
      <legend className="sr-only">Teams this person can see</legend>
      {TEAMS.map((t) => (
        <label key={t} htmlFor={`${idPrefix}-${t}`} className="flex items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-${t}`}
            type="checkbox"
            className="size-4"
            checked={value.includes(t)}
            onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))}
          />
          {t}
        </label>
      ))}
    </fieldset>
  )
}

function StaffRow({ person, roles, busy, onSave, onRemove }: {
  person: { email: string; role: string; teams: Team[]; name: string | null; coachTeam: Team | null; lastSignInAt: string | null }
  roles: { key: string; label: string }[]
  busy: boolean
  onSave: (email: string, role: string, teams: Team[]) => void
  onRemove: (email: string) => void
}) {
  const [role, setRole] = useState(person.role)
  const [teams, setTeams] = useState<Team[]>(person.teams)
  const dirty = role !== person.role || [...teams].sort().join() !== [...person.teams].sort().join()
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <span className="font-medium">{person.name ?? person.email}</span>
          {person.name && <span className="ml-2 text-sm text-muted-foreground">{person.email}</span>}
          {!person.name && <span className="ml-2 text-sm text-amber-800">Not on the coach roster</span>}
        </span>
        <span className="text-sm text-muted-foreground">
          {person.lastSignInAt
            ? `Last signed in ${new Date(person.lastSignInAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })} ET`
            : 'Has not signed in yet'}
        </span>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select aria-label={`Role for ${person.email}`} value={role} onChange={(e) => setRole(e.target.value)} className={`${selectClass} lg:w-64`}>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <div className="flex-1"><TeamPicker value={teams} onChange={setTeams} idPrefix={`t-${person.email}`} /></div>
        <span className="flex gap-2">
          <Button type="button" className="h-9" disabled={busy || !dirty || teams.length === 0} onClick={() => onSave(person.email, role, teams)}>Save</Button>
          <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => onRemove(person.email)}><UserMinus aria-hidden="true" />Remove</Button>
        </span>
      </div>
    </li>
  )
}

export function AccessView() {
  const { accessConfig, coaches, setViewAccess, setStaffAccess, isDemo } = useApp()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [teams, setTeams] = useState<Team[]>([])

  if (isDemo || !accessConfig) {
    return <PageHeader title="Roles & Access" description="Role settings are not available right now. Refresh the page, and if this continues email it@svlacrosse.org." />
  }
  const config = accessConfig
  const chosenRole = role || config.roles[0]?.key || ''
  const level = (r: string, v: string): AccessLevel => config.matrix.find((m) => m.role === r && m.view === v)?.level ?? 'none'
  const roleLabel = (key: string) => config.roles.find((r) => r.key === key)?.label ?? key

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.') }
    finally { setBusy(false) }
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError('Enter a valid email address.')
    if (teams.length === 0) return setError('Choose at least one team.')
    void run(async () => { await setStaffAccess(value, chosenRole, teams); setEmail(''); setTeams([]) }, `${value} is now a ${roleLabel(chosenRole)} for ${teams.join(', ')}.`)
  }

  return (
    <>
      <PageHeader
        title="Roles & Access"
        description="Choose what each role can see. The board always sees everything. Changes apply the next time that person loads the app, and every change is logged."
      />

      <section aria-labelledby="matrix-heading" className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h2 id="matrix-heading" className="mb-1 text-lg font-semibold text-navy">What each role can see</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Roles see only the teams you assign them below. Rows marked <strong>Board only</strong> cannot be delegated yet. Everything a role can see is
          status information; uploaded documents and certificate details are never shown to anyone outside the board.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b text-sm text-muted-foreground">
                <th scope="col" className="py-3 pr-4 font-medium">View</th>
                <th scope="col" className="px-3 py-3 font-medium">Board</th>
                {config.roles.map((r) => (
                  <th key={r.key} scope="col" className="px-3 py-3 font-medium" title={r.description}>{r.label}</th>
                ))}
                <th scope="col" className="px-3 py-3 font-medium">Coach</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {config.views.map((v) => (
                <tr key={v.key}>
                  <th scope="row" className="py-3 pr-4 font-normal">
                    <span className="block font-medium">{v.label}</span>
                    <span className="block text-sm text-muted-foreground">{v.description}</span>
                  </th>
                  <td className="px-3 py-3 text-sm text-muted-foreground">Full</td>
                  {config.roles.map((r) => (
                    <td key={r.key} className="px-3 py-3">
                      {v.maxLevel === 'none' ? (
                        <span className="text-sm text-muted-foreground">Board only</span>
                      ) : (
                        <select
                          aria-label={`${r.label}: ${v.label}`}
                          value={level(r.key, v.key)}
                          disabled={busy}
                          onChange={(e) => {
                            const next = e.target.value as AccessLevel
                            void run(() => setViewAccess(r.key, v.key, next), `${r.label}: ${v.label} set to "${LEVEL_LABELS[next]}".`)
                          }}
                          className="h-10 rounded-lg border border-input bg-card px-2 text-base"
                        >
                          {(['none', 'view', 'manage'] as AccessLevel[]).filter((l) => rank(l) <= rank(v.maxLevel)).map((l) => (
                            <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-sm text-muted-foreground">Own record</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p role="status" className={message ? 'mt-3 text-sm text-muted-foreground' : 'sr-only'}>{message}</p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      <section aria-labelledby="staff-heading" className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h2 id="staff-heading" className="mb-1 text-lg font-semibold text-navy">Give someone a role</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Pick the coach, the role, and the teams they supervise. They sign in with the same email as their coach account and see only those teams.
        </p>
        <form onSubmit={handleAdd} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-email">Coach email</Label>
              <Input id="staff-email" type="email" list="staff-email-options" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="off" className="h-10 bg-card text-base" />
              <datalist id="staff-email-options">
                {coaches.map((c) => <option key={c.id} value={c.email}>{c.name} · {c.team}</option>)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <select id="staff-role" value={chosenRole} onChange={(e) => setRole(e.target.value)} className={selectClass}>
                {config.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Teams they can see</span>
            <TeamPicker value={teams} onChange={setTeams} idPrefix="new" />
          </div>
          <div><Button type="submit" className="h-10 px-4" disabled={busy}><UserPlus aria-hidden="true" />Add role</Button></div>
        </form>
      </section>

      <section aria-labelledby="holders-heading" className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 id="holders-heading" className="mb-1 text-lg font-semibold text-navy">People with a role ({config.staff.length})</h2>
        {config.staff.length === 0
          ? <p className="text-sm text-muted-foreground">No one has a role yet. Everyone other than the board sees only their own record.</p>
          : (
            <ul className="divide-y">
              {config.staff.map((p) => (
                <StaffRow
                  key={`${p.email}:${p.role}:${p.teams.join()}`}
                  person={p}
                  roles={config.roles}
                  busy={busy}
                  onSave={(e, r, t) => void run(() => setStaffAccess(e, r, t), `Saved ${e}.`)}
                  onRemove={(e) => { if (window.confirm(`Remove the role for ${e}? They will go back to seeing only their own record.`)) void run(() => setStaffAccess(e, null, []), `${e} no longer has a role.`) }}
                />
              ))}
            </ul>
          )}
      </section>
    </>
  )
}
