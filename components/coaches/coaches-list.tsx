'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { PAY_STATUSES, TEAMS, loginStateOf } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'
import { CoachesTable } from '@/components/dashboard/coaches-table'
import { AddCoachDialog } from './add-coach-dialog'
import { PendingAccounts } from './pending-accounts'

const selectClass =
  'h-10 rounded-lg border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-brand'

export function CoachesList() {
  const { summaries, archivedSummaries, loginByEmail, inviteCoaches, isDemo } = useApp()
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('all')
  const [pay, setPay] = useState('all')
  const [addedName, setAddedName] = useState('')
  const [login, setLogin] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [bulk, setBulk] = useState<'idle' | 'confirm' | 'sending'>('idle')
  const [bulkMessage, setBulkMessage] = useState('')

  const stateOf = (email: string) => loginStateOf(loginByEmail[email.toLowerCase()])
  const hasLoginData = !isDemo && Object.keys(loginByEmail).length > 0
  const counts = { active: 0, invited: 0, none: 0 }
  for (const s of summaries) counts[stateOf(s.coach.email)]++
  const uninvited = summaries.filter((s) => stateOf(s.coach.email) === 'none')
  const invited = summaries.filter((s) => stateOf(s.coach.email) === 'invited')
  const [resend, setResend] = useState<'idle' | 'confirm' | 'sending'>('idle')

  // Resend to everyone still in Invited status. Sent in small batches so one request never nears the server time limit.
  async function sendResend() {
    const ids = invited.map((s) => s.coach.id)
    let sent = 0
    const failed: string[] = []
    setResend('sending'); setBulkMessage('')
    try {
      for (let i = 0; i < ids.length; i += 10) {
        const result = await inviteCoaches(ids.slice(i, i + 10))
        sent += result.sent
        failed.push(...result.failed)
      }
      setBulkMessage(`${sent} invite${sent === 1 ? '' : 's'} resent.${failed.length ? ` Could not send to: ${failed.join(', ')}. Open each coach and use Copy sign-in link instead.` : ''}`)
    } catch (e) {
      setBulkMessage(`${e instanceof Error ? e.message : 'Could not resend the invites.'}${sent ? ` ${sent} invite${sent === 1 ? ' was' : 's were'} sent before the problem.` : ''}`)
    } finally { setResend('idle') }
  }

  async function sendBulk() {
    setBulk('sending'); setBulkMessage('')
    try {
      const { sent, failed } = await inviteCoaches(uninvited.map((s) => s.coach.id))
      setBulkMessage(`${sent} invite${sent === 1 ? '' : 's'} sent.${failed.length ? ` Could not send to: ${failed.join(', ')}. Open each coach and use Copy sign-in link instead.` : ''}`)
    } catch (e) { setBulkMessage(e instanceof Error ? e.message : 'Could not send the invites.') }
    finally { setBulk('idle') }
  }

  const q = query.trim().toLowerCase()
  const visible = (showArchived ? archivedSummaries : summaries).filter(
    (s) =>
      (!q || s.coach.name.toLowerCase().includes(q) || s.coach.email.toLowerCase().includes(q)) &&
      (team === 'all' || s.coach.team === team) &&
      (pay === 'all' || s.coach.pay === pay) &&
      (login === 'all' || stateOf(s.coach.email) === login),
  )

  return (
    <>
      <PageHeader
        title="Coaches & Volunteers"
        description={hasLoginData ? `${summaries.length} people on staff this season · ${counts.active} active · ${counts.invited} invited · ${counts.none} no login` : `${summaries.length} people on staff this season.`}
        actions={<>
          {hasLoginData && invited.length > 0 && (
            resend === 'idle' ? (
              <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setResend('confirm')}>Resend invites ({invited.length})</Button>
            ) : resend === 'confirm' ? (
              <>
                <Button type="button" className="h-10 px-4" onClick={() => void sendResend()}>Confirm: resend to {invited.length}</Button>
                <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setResend('idle')}>Cancel</Button>
              </>
            ) : <span role="status" className="self-center text-sm text-muted-foreground">Sending… this can take up to a minute.</span>
          )}
          <AddCoachDialog onAdded={(name) => {
            setQuery('')
            setTeam('all')
            setPay('all')
            setLogin('all')
            setAddedName(name)
          }} />
        </>}
      />
      <p role="status" className={addedName ? 'mb-4 text-sm text-muted-foreground' : 'sr-only'}>
        {addedName && `${addedName} added to the roster. Their requirements checklist is ready.`}
      </p>
      {hasLoginData && uninvited.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <p className="flex-1 text-sm leading-relaxed">{uninvited.length} coach{uninvited.length === 1 ? ' has' : 'es have'} no login yet. Send them all an email to set up their account.</p>
          {bulk === 'idle' ? <Button type="button" className="h-10 px-4" onClick={() => setBulk('confirm')}>Invite all without a login</Button> : bulk === 'confirm' ? (
            <>
              <Button type="button" className="h-10 px-4" onClick={() => void sendBulk()}>Confirm: send {uninvited.length}</Button>
              <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setBulk('idle')}>Cancel</Button>
            </>
          ) : <span role="status" className="text-sm text-muted-foreground">Sending… this takes a few seconds.</span>}
        </div>
      )}
      {bulkMessage && <p role="status" className="mb-4 text-sm leading-relaxed">{bulkMessage}</p>}
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
          {hasLoginData && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-filter">Login</Label>
              <select id="login-filter" value={login} onChange={(e) => setLogin(e.target.value)} className={selectClass}>
                <option value="all">All</option>
                <option value="none">No login</option>
                <option value="invited">Invited</option>
                <option value="active">Active</option>
              </select>
            </div>
          )}
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
      {!isDemo && (archivedSummaries.length > 0 || showArchived) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4" />Show archived coaches ({archivedSummaries.length})</label>
          {showArchived && <span className="text-muted-foreground">Open an archived coach to restore the record or delete it permanently.</span>}
        </div>
      )}
      <CoachesTable summaries={visible} showLogin={hasLoginData && !showArchived} />
    </>
  )
}
