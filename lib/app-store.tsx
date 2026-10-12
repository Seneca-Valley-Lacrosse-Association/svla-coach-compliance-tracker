'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { summarizeCoach, type CoachSummary } from './compliance'
import * as demo from './demo-data'
import { createClient } from './supabase/client'
import { AuthPanel } from '@/components/auth-panel'
import type { Coach, Requirement, Submission } from './types'

export type ViewMode = 'board' | 'coach'
export type UploadInput = Pick<Submission, 'coachId' | 'requirementId' | 'completedOn' | 'fileName' | 'obtainedAs' | 'fbiMethod' | 'membershipNumber' | 'signedName'> & { membershipExpiry?: string; agreed?: boolean; file?: File }
type ResourceInput = Pick<Requirement, 'help' | 'helpUrl' | 'helpLinkLabel'>
interface Snapshot { user: { id: string; email: string; role: ViewMode } | null; coaches: Coach[]; requirements: Requirement[]; submissions: Submission[] }
interface AppState {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  isDemo: boolean
  email: string
  signOut: () => Promise<void>
  currentCoachId: string
  coaches: Coach[]
  addCoach: (input: Omit<Coach, 'id'>) => Promise<void>
  requirements: Requirement[]
  submissions: Submission[]
  summaries: CoachSummary[]
  getSummary: (coachId: string) => CoachSummary | undefined
  submitUpload: (input: UploadInput) => Promise<void>
  reviewSubmission: (id: string, decision: 'approved' | 'rejected', comment?: string) => Promise<void>
  addRequirement: (req: Omit<Requirement, 'id' | 'order'>) => Promise<void>
  setRequirementActive: (id: string, active: boolean) => Promise<void>
  updateResource: (id: string, input: ResourceInput) => Promise<void>
}
const AppContext = createContext<AppState | null>(null)
const empty: Snapshot = { user: null, coaches: [], requirements: [], submissions: [] }
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
  const { coaches, requirements, submissions, user } = snapshot
  const summaries = useMemo(() => coaches.map(c => summarizeCoach(c, requirements, submissions)), [coaches, requirements, submissions])
  async function save(command: Record<string, unknown>) {
    if (isDemo) throw new Error('The board demo is read-only. Sign in to manage live records.')
    const response = await fetch('/api/app', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SVLA-Request': '1' }, body: JSON.stringify(command) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Could not save your changes.')
    await mutate()
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
    coaches, requirements, submissions, summaries,
    getSummary: id => summaries.find(s => s.coach.id === id),
    addCoach: input => save({ action: 'addCoach', input }),
    addRequirement: input => save({ action: 'addRequirement', input }),
    setRequirementActive: (id, active) => save({ action: 'setRequirementActive', id, active }),
    updateResource: (id, input) => save({ action: 'updateResource', id, input }),
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
  if (!isDemo && isLoading) return <main className="flex min-h-dvh items-center justify-center"><p role="status">Loading your secure workspace…</p></main>
  if (!isDemo && error) return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6"><p role="alert">Unable to load the workspace. Your records have not been changed.</p><button onClick={() => void mutate()} className="text-primary underline">Try again</button><a href="/demo" className="text-primary underline">Open board demo</a></main>
  if (!isDemo && !user) return <AuthPanel onSignedIn={() => mutate()} />
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
