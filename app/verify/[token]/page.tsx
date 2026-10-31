import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { badgeRole, formatDate, summarizeCoach, type ProgramSummary } from '@/lib/compliance'
import { PROGRAM_LABELS, type Coach, type Requirement, type Submission } from '@/lib/types'

// Public page behind a badge QR code. No sign-in. It shows clearance status and dates only: no contact details,
// documents, pay status, or reasons an item is not current.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'SVLA Coach Verification',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

interface Payload {
  coach: Omit<Coach, 'id' | 'email' | 'phone'>
  requirements: Requirement[]
  submissions: (Omit<Submission, 'id' | 'coachId' | 'uploadedOn'> & { uploadedOn?: string; obtainedAs?: 'Volunteer' | 'Employment' | null; fbiMethod?: 'fingerprint' | 'affidavit' | null; fbiCheck?: Submission['fbiCheck'] | null; membershipNumber?: string | null })[]
}

const checkedAt = () => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date())

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-white text-slate-900 shadow-sm">
      {children}
      <footer className="mt-auto border-t px-5 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/svla-logo.jpg" alt="Seneca Valley Raiders Lacrosse" className="mx-auto h-auto w-48" />
      </footer>
    </main>
  )
}

function ProgramBox({ p }: { p: ProgramSummary }) {
  const label = PROGRAM_LABELS[p.program]
  const tone = p.cleared ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : p.assigned ? 'border-red-700 bg-red-50 text-red-800' : 'border-slate-300 bg-slate-50 text-slate-600'
  return (
    <div className={`rounded-xl border-2 px-3 py-2 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className={p.assigned ? 'text-3xl font-bold' : 'pt-1 text-base font-semibold'}>{p.cleared ? 'YES' : p.assigned ? 'NO' : 'Not assigned'}</p>
    </div>
  )
}

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = await createClient()

  // A signed-in board member who scans a badge goes straight to the full coach profile.
  const { data: { user } } = await db.auth.getUser()
  if (user?.email) {
    const board = await db.from('board_members').select('email').eq('email', user.email.toLowerCase()).maybeSingle()
    if (board.data) {
      const coach = await db.from('coaches').select('id').eq('verify_token', token).maybeSingle()
      if (coach.data) redirect(`/coaches/${coach.data.id}`)
    }
  }

  const { data, error } = await db.rpc('verify_badge', { p_token: token })
  const payload = (error ? null : data) as Payload | null

  if (!payload) {
    return (
      <Shell>
        <div className="bg-[#0e2a44] px-5 py-4 text-white"><p className="text-xs font-semibold tracking-widest opacity-80">SVLA · COACH VERIFICATION</p></div>
        <div className="flex flex-col gap-2 px-5 py-8">
          <h1 className="text-2xl font-bold">Not an active SVLA coach</h1>
          <p className="text-slate-600">This badge is not recognized, or the coach is no longer active. Ask the coach to contact SVLA for a new badge.</p>
        </div>
      </Shell>
    )
  }

  const coach: Coach = { ...payload.coach, id: 'badge', email: '', phone: '' }
  const submissions: Submission[] = payload.submissions.map((s, i) => ({ ...s, id: `s${i}`, coachId: 'badge', uploadedOn: s.uploadedOn ?? '' } as Submission))
  const summary = summarizeCoach(coach, payload.requirements, submissions, [])
  const member = submissions.find((s) => s.requirementId === 'usal-membership' && s.status === 'approved' && (s as { membershipNumber?: string }).membershipNumber)
  const memberNumber = (member as { membershipNumber?: string } | undefined)?.membershipNumber

  return (
    <Shell>
      <div className="bg-[#0e2a44] px-5 pb-4 pt-4 text-white">
        <p className="text-xs font-semibold tracking-widest opacity-80">SVLA · COACH VERIFICATION</p>
        <h1 className="mt-1 text-3xl font-bold uppercase leading-tight">{coach.name}</h1>
        <p className="text-sm opacity-85">{badgeRole(coach)}</p>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="grid grid-cols-2 gap-3">{summary.programs.map((p) => <ProgramBox key={p.program} p={p} />)}</div>
        {memberNumber && (
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">USA Lacrosse member no.</p>
            <p className="text-lg font-semibold tabular-nums tracking-wide">{memberNumber}</p>
          </div>
        )}
        {summary.programs.filter((p) => p.assigned).map((p) => (
          <section key={p.program} aria-label={`${PROGRAM_LABELS[p.program]} requirements`}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{PROGRAM_LABELS[p.program]} requirements</h2>
            <ul className="mt-1 divide-y">
              {p.items.map((i) => (
                <li key={i.requirement.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span><span aria-hidden="true" className={i.satisfied ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>{i.satisfied ? '✓ ' : '— '}</span>{i.requirement.name}</span>
                  <span className={`whitespace-nowrap tabular-nums ${i.satisfied ? 'text-slate-500' : 'font-semibold text-red-700'}`}>
                    {i.satisfied ? (i.approved?.expiresOn ? `thru ${formatDate(i.approved.expiresOn)}` : 'no expiry') : 'Not current'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="border-t pt-3 text-xs text-slate-500">Checked live on {checkedAt()} from SVLA records.</p>
      </div>
    </Shell>
  )
}
