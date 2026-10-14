'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { summarizeCoach, type CoachSummary } from './compliance'
import * as demo from './demo-data'
import { createClient } from './supabase/client'
import { AuthPanel } from '@/components/auth-panel'
import { ResetPasswordPanel } from '@/components/reset-password-panel'
import { ConfirmLinkPanel } from '@/components/confirm-link-panel'
import { CompleteProfilePanel } from '@/components/complete-profile-panel'
import { WaitingApprovalPanel } from '@/components/waiting-approval-panel'
import type { Coach, LoginInfo, Requirement, Submission } from './types'

export type ViewMode = 'board' | 'coach'
export type UploadInput = Pick<Submission, 'coachId' | 'requirementId' | 'completedOn' | 'fileName' | 'obtainedAs' | 'fbiMethod' | 'membershipNumber' | 'signedName'> & { membershipExpiry?: string; agreed?: boolean; file?: File }
type ResourceInput = Pick<Requirement, 'help' | 'helpUrl' | 'helpLinkLabel'> & Partial<Pick<Requirement, 'level' | 'why' | 'source' | 'sourceUrl' | 'appliesToRoles' | 'appliesToPay' | 'appliesToTeams'>>
interface Snapshot { user: { id: string; email: string; role: ViewMode } | null; coaches: Coach[]; requirements: Requirement[]; submissions: Submission[]; boardMembers?: { email: string; lastSignInAt?: string | null }[]; pendingAccounts?: { email: string; created_at: string }[]; loginStatus?: LoginInfo[] }
interface AppState {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  isDemo: boolean
  email: string
  signOut: () => Promise<void>
  currentCoachId: string
  coaches: Coach[]
  /** Coaches waiting for (or refused) board approval. */
  awaitingCoaches: Coach[]
  /** Approval state of the signed-in coach's own record. */
  myStatus: 'none' | 'pending' | 'approved' | 'declined'
  reviewCoach: (id: string, decision: 'approved' | 'declined', pay: Coach['pay']) => Promise<{ emailSent?: boolean }>
  addCoach: (input: Omit<Coach, 'id'>) => Promise<void>
  registerSelf: (input: { name: string; phone: string; team: Coach['team']; role: Coach['role']; paResident10Years: boolean }) => Promise<void>
  deleteCoach: (id: string) => Promise<void>
  removeAccount: (email: string) => Promise<void>
  editCoach: (id: string, input: Omit<Coach, 'id' | 'email'>) => Promise<void>
  pendingAccounts: { email: string; created_at: string }[]
  /** Sign-in account info per coach email (board only). Empty in the demo. */
  loginByEmail: Record<string, LoginInfo>
  inviteCoach: (id: string, deliver: 'email' | 'link') => Promise<{ emailSent?: boolean; link?: string }>
  inviteCoaches: (ids: string[]) => Promise<{ sent: number; failed: string[] }>
  requirements: Requirement[]
  submissions: Submission[]
  summaries: CoachSummary[]
  getSummary: (coachId: string) => CoachSummary | undefined
  submitUpload: (input: UploadInput) => Promise<void>
  reviewSubmission: (id: string, decision: 'approved' | 'rejected', comment?: string) => Promise<void>
  addRequirement: (req: Omit<Requirement, 'id' | 'order'>) => Promise<void>
  setRequirementActive: (id: string, active: boolean) => Promise<void>
  updateResource: (id: string, input: ResourceInput) => Promise<void>
  boardMembers: { email: string; lastSignInAt?: string | null }[]
  addBoardMember: (email: string) => Promise<void>
  removeBoardMember: (email: string) => Promise<void>
}
const AppContext = createContext<AppState | null>(null)
const empty: Snapshot = { user: null, coaches: [], requirements: [], submissions: [], boardMembers: [], pendingAccounts: [] }
const demoSnapshot: Snapshot = { user: { id: 'demo', email: 'board-demo@example.org', role: 'board' }, ...demo }
async function loadSnapshot(url: string): Promise<Snapshot> {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to load records.')
  return result
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDemo = pathname === '/demo' || pathname.startsWith('/demo/')
  const [demoView, setDemoView] = useState<ViewMode>('board')
  const { data, error, isLoading, mutate } = useSWR<Snapshot>(isDemo ? null : '/api/app', loadSnapshot, { refreshInterval: 60000, shouldRetryOnError: false })
  const snapshot = isDemo ? demoSnapshot : data ?? empty
  const { requirements, submissions, user } = snapshot
  const allCoaches = snapshot.coaches
  const coaches = useMemo(() => allCoaches.filter(c => (c.status ?? 'approved') === 'approved'), [allCoaches])
  const awaitingCoaches = useMemo(() => allCoaches.filter(c => c.status === 'pending' || c.status === 'declined'), [allCoaches])
  const mine = isDemo ? undefined : allCoaches.find(c => c.email.toLowerCase() === user?.email?.toLowerCase())
  const summaries = useMemo(() => coaches.map(c => summarizeCoach(c, requirements, submissions)), [coaches, requirements, submissions])
  async function save(command: Record<string, unknown>) {
    if (isDemo) throw new Error('The board demo is read-only. Sign in to manage live records.')
    const response = await fetch('/api/app', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SVLA-Request': '1' }, body: JSON.stringify(command) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Could not save your changes.')
    await mutate()
    return result
  }
  const value: AppState = {
    viewMode: isDemo ? demoView : user?.role ?? 'coach',
    setViewMode: mode => { if (isDemo) setDemoView(mode) },
    isDemo, email: user?.email ?? '',
    signOut: async () => {
      const { error } = await createClient().auth.signOut()
      if (error) throw new Error('Unable to sign out. Please try again.')
      await mutate(empty, { revalidate: false })
    },
    currentCoachId: isDemo ? 'c3' : coaches.find(c => c.email.toLowerCase() === user?.email?.toLowerCase())?.id ?? '',
    coaches, awaitingCoaches, myStatus: isDemo ? 'approved' : mine ? (mine.status ?? 'approved') : 'none', requirements, submissions, summaries,
    reviewCoach: (id, decision, pay) => save({ action: 'reviewCoach', id, decision, pay }),
    getSummary: id => summaries.find(s => s.coach.id === id),
    addCoach: input => save({ action: 'addCoach', input }),
    registerSelf: input => save({ action: 'registerSelf', input }),
    removeAccount: email => save({ action: 'removeAccount', email }),
    deleteCoach: id => save({ action: 'deleteCoach', id }),
    editCoach: (id, input) => save({ action: 'editCoach', id, input }),
    pendingAccounts: snapshot.pendingAccounts ?? [],
    loginByEmail: Object.fromEntries((snapshot.loginStatus ?? []).map(l => [l.email.toLowerCase(), l])),
    inviteCoach: (id, deliver) => save({ action: 'inviteCoach', id, deliver }),
    inviteCoaches: ids => save({ action: 'inviteCoaches', ids }),
    addRequirement: input => save({ action: 'addRequirement', input }),
    setRequirementActive: (id, active) => save({ action: 'setRequirementActive', id, active }),
    updateResource: (id, input) => save({ action: 'updateResource', id, input }),
    boardMembers: snapshot.boardMembers ?? [],
    addBoardMember: email => save({ action: 'addBoardMember', email }),
    removeBoardMember: email => save({ action: 'removeBoardMember', email }),
    reviewSubmission: (id, decision, comment) => save({ action: 'reviewSubmission', id, decision, comment }),
    submitUpload: async ({ file, ...input }) => {
      if (isDemo) throw new Error('The board demo is read-only.')
      let filePath: string | undefined
      const db = createClient()
      if (file) {
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 10485760 || file.size === 0) throw new Error('Choose a PDF, JPG, or PNG between 1 byte and 10 MB.')
        const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
        filePath = `${input.coachId}/${crypto.randomUUID()}.${extension}`
        const { error } = await db.storage.from('certificates').upload(filePath, file, { contentType: file.type, upsert: false })
        if (error) throw new Error('Document upload failed. Check your permissions and try again.')
      }
      try { await save({ action: 'submitUpload', input: { ...input, filePath, fileName: file?.name } }) }
      catch (error) {
        if (filePath) await db.storage.from('certificates').remove([filePath])
        throw error
      }
    },
  }
  if (pathname === '/auth/confirm') return <ConfirmLinkPanel />
  if (pathname === '/auth/reset') return isLoading ? <main className="flex min-h-dvh items-center justify-center"><p role="status">Loading…</p></main> : <ResetPasswordPanel signedIn={!!user} />
  if (!isDemo && isLoading) return <main className="flex min-h-dvh items-center justify-center"><p role="status">Loading your secure workspace…</p></main>
  if (!isDemo && error) return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6"><p role="alert">Unable to load the workspace. Your records have not been changed.</p><button onClick={() => void mutate()} className="text-primary underline">Try again</button><a href="/demo" className="text-primary underline">Open board demo</a></main>
  if (!isDemo && !user) return <AuthPanel onSignedIn={() => mutate()} />
  const isCoachUser = !isDemo && user?.role === 'coach'
  const gate = isCoachUser && value.myStatus === 'none' ? <CompleteProfilePanel /> : isCoachUser && (value.myStatus === 'pending' || value.myStatus === 'declined') ? <WaitingApprovalPanel /> : null
  return <AppContext.Provider value={value}>{gate ?? children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
