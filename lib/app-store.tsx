'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
import { ArchivedPanel } from '@/components/archived-panel'
import { NO_ACCESS, type AccessConfig, type AccessInfo, type Coach, type LoginInfo, type Progress, type Requirement, type StaffData, type Submission, type Team } from './types'

export type ViewMode = 'board' | 'coach'
export type UploadInput = Pick<Submission, 'coachId' | 'requirementId' | 'completedOn' | 'fileName' | 'obtainedAs' | 'fbiMethod' | 'fbiCheck' | 'membershipNumber' | 'signedName'> & { membershipExpiry?: string; agreed?: boolean; file?: File }
type ResourceInput = Pick<Requirement, 'help' | 'helpUrl' | 'helpLinkLabel'> & Partial<Pick<Requirement, 'name' | 'level' | 'why' | 'source' | 'sourceUrl' | 'sources' | 'appliesToRoles' | 'appliesToPay'>>
export interface PreviewData { email: string; name: string | null; access: AccessInfo; staff: StaffData }
interface Snapshot { user: { id: string; email: string; role: ViewMode } | null; coaches: Coach[]; requirements: Requirement[]; submissions: Submission[]; progress?: Progress[]; boardMembers?: { email: string; lastSignInAt?: string | null }[]; pendingAccounts?: { email: string; created_at: string }[]; loginStatus?: LoginInfo[]; access?: AccessInfo; staff?: StaffData; accessConfig?: AccessConfig }
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
  /** Archived coaches (board only view). */
  archivedCoaches: Coach[]
  archivedSummaries: CoachSummary[]
  removeSubmission: (id: string) => Promise<void>
  archiveCoach: (id: string) => Promise<void>
  restoreCoach: (id: string) => Promise<void>
  reissueBadge: (id: string) => Promise<void>
  editSubmissionDates: (id: string, completedOn: string, note?: string, membershipExpiry?: string) => Promise<void>
  /** Approval state of the signed-in coach's own record. */
  myStatus: 'none' | 'pending' | 'approved' | 'declined' | 'archived'
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
  progress: Progress[]
  markInProgress: (input: { coachId: string; requirementId: string; startedOn: string; followUpOn?: string; note?: string }) => Promise<void>
  clearInProgress: (coachId: string, requirementId: string) => Promise<void>
  reviewSubmission: (id: string, decision: 'approved' | 'rejected', comment?: string) => Promise<void>
  addRequirement: (req: Omit<Requirement, 'id' | 'order'>) => Promise<void>
  setRequirementActive: (id: string, active: boolean) => Promise<void>
  setRequirementReview: (id: string, requiresReview: boolean) => Promise<void>
  updateResource: (id: string, input: ResourceInput) => Promise<void>
  boardMembers: { email: string; lastSignInAt?: string | null }[]
  addBoardMember: (email: string) => Promise<void>
  removeBoardMember: (email: string) => Promise<void>
  inviteBoardMember: (email: string, deliver: 'email' | 'link') => Promise<{ emailSent?: boolean; link?: string }>
  /** What the signed-in person may see beyond their own record (view-only roles). */
  access: AccessInfo
  /** True when a limited role can open the team compliance page. */
  hasTeamView: boolean
  /** Status-only rows for a limited role, already filtered to their teams by the database. */
  staff: StaffData
  /** Board only: roles, views, the permission matrix and who holds which role. */
  accessConfig: AccessConfig | null
  setViewAccess: (role: string, view: string, level: 'none' | 'view' | 'manage') => Promise<void>
  setStaffAccess: (email: string, role: string | null, teams: Team[]) => Promise<void>
  /** Board only. What another person would see; null unless a preview is running. Read-only: nothing here changes who you are signed in as. */
  preview: PreviewData | null
  /** The previewed person's own checklist, built the same way they see it. Null if they are not an active roster coach. */
  previewSummary: CoachSummary | null
  /** Why there is no checklist to show for the previewed person. */
  previewRosterState: 'active' | 'awaiting' | 'archived' | 'none'
  previewLoading: boolean
  previewError: string
  startPreview: (email: string) => Promise<void>
  stopPreview: () => void
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
  // The public badge verification page needs no sign-in and loads none of the workspace.
  const isVerify = pathname.startsWith('/verify/')
  const [demoView, setDemoView] = useState<ViewMode>('board')
  const { data, error, isLoading, mutate } = useSWR<Snapshot>(isDemo || isVerify ? null : '/api/app', loadSnapshot, { refreshInterval: 60000, shouldRetryOnError: false })
  const snapshot = isDemo ? demoSnapshot : data ?? empty
  // Preview-as: remembered for this tab only, and only honoured for board members (the server refuses everyone else).
  const [previewEmail, setPreviewEmail] = useState('')
  useEffect(() => { try { setPreviewEmail(sessionStorage.getItem('svla-preview') ?? '') } catch { /* storage unavailable */ } }, [])
  const canPreview = !isDemo && data?.user?.role === 'board'
  const previewKey = canPreview && previewEmail ? `/api/app/preview?email=${encodeURIComponent(previewEmail)}` : null
  const { data: previewData, error: previewFetchError, isLoading: previewLoading } = useSWR<PreviewData>(previewKey, loadSnapshot as unknown as (url: string) => Promise<PreviewData>, { refreshInterval: 60000, shouldRetryOnError: false })
  const { requirements, submissions, user } = snapshot
  const progress = useMemo(() => snapshot.progress ?? [], [snapshot.progress])
  const allCoaches = snapshot.coaches
  const coaches = useMemo(() => allCoaches.filter(c => (c.status ?? 'approved') === 'approved' && !c.archivedAt), [allCoaches])
  const archivedCoaches = useMemo(() => allCoaches.filter(c => (c.status ?? 'approved') === 'approved' && !!c.archivedAt), [allCoaches])
  const awaitingCoaches = useMemo(() => allCoaches.filter(c => c.status === 'pending' || c.status === 'declined'), [allCoaches])
  const mine = isDemo ? undefined : allCoaches.find(c => c.email.toLowerCase() === user?.email?.toLowerCase())
  const summaries = useMemo(() => coaches.map(c => summarizeCoach(c, requirements, submissions, progress)), [coaches, requirements, submissions, progress])
  const previewCoach = useMemo(() => previewData ? allCoaches.find(c => c.email.toLowerCase() === previewData.email.toLowerCase()) : undefined, [previewData, allCoaches])
  const previewRosterState: 'active' | 'awaiting' | 'archived' | 'none' = !previewCoach ? 'none' : previewCoach.archivedAt ? 'archived' : (previewCoach.status ?? 'approved') === 'approved' ? 'active' : 'awaiting'
  const previewSummary = useMemo(() => previewCoach && previewRosterState === 'active' ? summarizeCoach(previewCoach, requirements, submissions, progress) : null, [previewCoach, previewRosterState, requirements, submissions, progress])
  const archivedSummaries = useMemo(() => archivedCoaches.map(c => summarizeCoach(c, requirements, submissions, progress)), [archivedCoaches, requirements, submissions, progress])
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
    coaches, awaitingCoaches, myStatus: isDemo ? 'approved' : mine ? (mine.archivedAt ? 'archived' : (mine.status ?? 'approved')) : 'none', archivedCoaches, archivedSummaries,
    removeSubmission: id => save({ action: 'removeSubmission', id }),
    archiveCoach: id => save({ action: 'archiveCoach', id }),
    restoreCoach: id => save({ action: 'restoreCoach', id }),
    reissueBadge: id => save({ action: 'reissueBadge', id }),
    editSubmissionDates: (id, completedOn, note, membershipExpiry) => save({ action: 'editSubmissionDates', id, completedOn, note, membershipExpiry }), requirements, submissions, summaries,
    reviewCoach: (id, decision, pay) => save({ action: 'reviewCoach', id, decision, pay }),
    getSummary: id => summaries.find(s => s.coach.id === id) ?? archivedSummaries.find(s => s.coach.id === id),
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
    setRequirementReview: (id, requiresReview) => save({ action: 'setRequirementReview', id, requiresReview }),
    updateResource: (id, input) => save({ action: 'updateResource', id, input }),
    boardMembers: snapshot.boardMembers ?? [],
    addBoardMember: email => save({ action: 'addBoardMember', email }),
    removeBoardMember: email => save({ action: 'removeBoardMember', email }),
    inviteBoardMember: (email, deliver) => save({ action: 'inviteBoardMember', email, deliver }),
    progress,
    markInProgress: input => save({ action: 'markInProgress', input }),
    clearInProgress: (coachId, requirementId) => save({ action: 'clearInProgress', coachId, requirementId }),
    reviewSubmission: (id, decision, comment) => save({ action: 'reviewSubmission', id, decision, comment }),
    access: isDemo ? NO_ACCESS : snapshot.access ?? NO_ACCESS,
    hasTeamView: !isDemo && !!(snapshot.access?.views.clearance_status || snapshot.access?.views.staff_roster),
    staff: snapshot.staff ?? { roster: [], status: [] },
    accessConfig: isDemo ? null : snapshot.accessConfig ?? null,
    setViewAccess: (role, view, level) => save({ action: 'setViewAccess', role, view, level }),
    setStaffAccess: (email, role, teams) => save({ action: 'setStaffAccess', email, role, teams }),
    preview: previewKey ? previewData ?? null : null,
    previewSummary: previewKey ? previewSummary : null,
    previewRosterState: previewKey ? previewRosterState : 'none',
    previewLoading: !!previewKey && previewLoading,
    previewError: previewFetchError instanceof Error ? previewFetchError.message : '',
    startPreview: async email => {
      const value = email.trim().toLowerCase()
      await save({ action: 'startPreview', email: value })
      try { sessionStorage.setItem('svla-preview', value) } catch { /* storage unavailable */ }
      setPreviewEmail(value)
    },
    stopPreview: () => {
      try { sessionStorage.removeItem('svla-preview') } catch { /* storage unavailable */ }
      setPreviewEmail('')
    },
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
  if (isVerify) return <>{children}</>
  if (pathname === '/auth/confirm') return <ConfirmLinkPanel />
  if (pathname === '/auth/reset') return isLoading ? <main className="flex min-h-dvh items-center justify-center"><p role="status">Loading…</p></main> : <ResetPasswordPanel signedIn={!!user} />
  if (!isDemo && isLoading) return <main className="flex min-h-dvh items-center justify-center"><p role="status">Loading your secure workspace…</p></main>
  if (!isDemo && error) return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6"><p role="alert">Unable to load the workspace. Your records have not been changed.</p><button onClick={() => void mutate()} className="text-primary underline">Try again</button><a href="/demo" className="text-primary underline">Open board demo</a></main>
  if (!isDemo && !user) return <AuthPanel onSignedIn={() => mutate()} />
  const isCoachUser = !isDemo && user?.role === 'coach'
  const gate = isCoachUser && value.myStatus === 'none' ? <CompleteProfilePanel /> : isCoachUser && (value.myStatus === 'pending' || value.myStatus === 'declined') ? <WaitingApprovalPanel /> : isCoachUser && value.myStatus === 'archived' ? <ArchivedPanel /> : null
  return <AppContext.Provider value={value}>{gate ?? children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
