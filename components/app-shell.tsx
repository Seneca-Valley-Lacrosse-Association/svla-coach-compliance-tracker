'use client'

import Link from '@/components/app-link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  IdCard,
  Eye,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react'
import { useApp, type ViewMode } from '@/lib/app-store'
import { IT_EMAIL } from '@/lib/tickets'
import { useTickets } from '@/lib/use-tickets'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { CoachSelfView } from './coach-self-view'
import { ChangePasswordDialog } from './change-password-dialog'
import { HelpButton, HelpProvider } from './help/help-provider'

const boardNav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/review', label: 'Review Queue', icon: Inbox },
  { href: '/requirements', label: 'Requirements', icon: ListChecks },
  { href: '/coaches', label: 'Coaches & Volunteers', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/badges', label: 'Badges', icon: IdCard },
  { href: '/tickets', label: 'Help Requests', icon: LifeBuoy },
  { href: '/board', label: 'Board Access', icon: UserCog },
  { href: '/access', label: 'Roles & Access', icon: SlidersHorizontal },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-light text-navy">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="font-semibold text-white">SVLA</p>
        <p className="text-sm text-sidebar-foreground/80">Compliance Tracker</p>
      </div>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { viewMode, summaries, isDemo, awaitingCoaches, currentCoachId, hasTeamView: realTeamView, preview, previewSummary } = useApp()
  const hasTeamView = preview ? !!(preview.access.views.clearance_status || preview.access.views.staff_roster) : realTeamView
  const { data: tickets } = useTickets()
  const openTickets = tickets?.openCount ?? 0
  const pendingCount = summaries.reduce(
    (n, s) => n + s.items.filter((i) => i.latest?.status === 'pending').length,
    0,
  ) + (isDemo ? 0 : awaitingCoaches.filter((c) => c.status === 'pending').length)

  if (viewMode === 'coach' || preview) {
    // A coach with a view-only role (for example a program lead) also gets their team's compliance page.
    const coachNav = [
      ...(!preview || previewSummary ? [{ href: '/', label: 'My Checklist', icon: ClipboardCheck }] : []),
      ...(hasTeamView ? [{ href: '/team', label: 'Team Compliance', icon: UsersRound }] : []),
    ]
    return (
      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {coachNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return coachNav.length === 1 ? (
            <span key={href} className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5 font-medium text-white">
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </span>
          ) : (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors',
                active ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white',
              )}
            >
              <Icon className={cn('size-5', active && 'text-brand-light')} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {[...(!isDemo && currentCoachId ? [{ href: '/my-checklist', label: 'My Checklist', icon: ClipboardCheck }] : []), ...boardNav].filter(({ href }) => !(isDemo && (href === '/badges' || href === '/board' || href === '/tickets' || href === '/access'))).map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname.replace(/^\/demo(?=\/|$)/, '') || '/', href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-white'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white',
            )}
          >
            <Icon className={cn('size-5', active && 'text-brand-light')} aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {href === '/review' && pendingCount > 0 && (
              <span className="rounded-full bg-brand-light px-2 text-sm font-semibold text-navy">
                {pendingCount}
              </span>
            )}
            {href === '/tickets' && openTickets > 0 && (
              <span className="rounded-full bg-brand-light px-2 text-sm font-semibold text-navy">
                <span className="sr-only">Open requests: </span>
                {openTickets}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function ViewToggle() {
  const { viewMode, setViewMode } = useApp()
  const options: { value: ViewMode; label: string }[] = [
    { value: 'board', label: 'Board' },
    { value: 'coach', label: 'Coach' },
  ]
  return (
    <div className="flex items-center gap-2">
      <span id="view-as-label" className="hidden text-sm text-white/80 sm:inline">
        Viewing as:
      </span>
      <div
        role="radiogroup"
        aria-labelledby="view-as-label"
        className="flex rounded-lg bg-white/10 p-1"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={viewMode === o.value}
            onClick={() => setViewMode(o.value)}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-light',
              viewMode === o.value ? 'bg-white text-navy' : 'text-white hover:bg-white/10',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PreviewNote({ preview }: { preview: NonNullable<ReturnType<typeof useApp>['preview']> }) {
  const { previewRosterState } = useApp()
  const who = preview.name ?? preview.email
  return (
    <div className="max-w-2xl rounded-xl border bg-card p-5 shadow-xs">
      <h1 className="mb-2 text-xl font-semibold text-navy">{who}</h1>
      <p className="leading-relaxed text-muted-foreground">
        {preview.access.isBoard
          ? 'This person is a board member, so they see everything in the tracker, including documents, the review queue and settings.'
          : previewRosterState === 'awaiting'
            ? 'This person has signed up but is still waiting for board approval, so they only see a waiting-for-approval message.'
            : previewRosterState === 'archived'
              ? 'This person\'s record is archived, so they only see an archived message and no checklist.'
              : 'This person is not on the coach roster, so they have no checklist and no extra access.'}
      </p>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Public badge verification: no sidebar, no sign-in, no workspace.
  if (pathname.startsWith('/verify/')) return <>{children}</>
  return <WorkspaceShell>{children}</WorkspaceShell>
}

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { viewMode, getSummary, currentCoachId, isDemo, email, signOut, hasTeamView, access, preview, previewSummary, previewError, stopPreview } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [signOutError, setSignOutError] = useState('')
  const me = getSummary(currentCoachId)
  // While previewing, team access is the previewed person's, not the signed-in board member's.
  const previewTeamView = !!preview && !!(preview.access.views.clearance_status || preview.access.views.staff_roster)
  // A previewed person with team access but no checklist of their own lands on Team Compliance, as they would.
  useEffect(() => {
    if (preview && !previewSummary && previewTeamView && !pathname.startsWith('/team')) router.replace('/team')
  }, [preview, previewSummary, previewTeamView, pathname, router])

  return (
    <HelpProvider>
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <Brand />
        <NavLinks />
        <p className="mt-auto px-6 py-5 text-sm text-sidebar-foreground/70">
          {isDemo ? 'Board demo · 5 fictional coaches. No real certificates.' : 'Private SVLA workspace. Records saved securely in Supabase.'}
        </p>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {(preview || previewError) && (
          <div role="status" className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-amber-500 bg-amber-100 px-4 py-3 text-sm text-amber-950 lg:px-8">
            <Eye className="size-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-relaxed">
              {preview ? (
                <>
                  <strong>You are previewing as {preview.name ?? preview.email}</strong> ({preview.email}
                  {preview.access.roleLabel ? ` · ${preview.access.roleLabel}` : ''}
                  {preview.access.teams && preview.access.teams.length ? ` · ${preview.access.teams.join(', ')}` : ''}).{' '}
                  Read-only: you are still signed in as {email}, and nothing here changes any record.
                </>
              ) : (
                <>The preview could not be loaded. {previewError}</>
              )}
            </p>
            <button type="button" className="shrink-0 rounded-md border border-amber-700 bg-white px-3 py-1.5 font-medium hover:bg-amber-50" onClick={() => { stopPreview(); router.push('/access') }}>Exit preview</button>
          </div>
        )}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-navy px-4 text-white lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 hover:bg-white/10 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <p className="truncate font-semibold lg:hidden">SVLA Compliance</p>
          {viewMode === 'coach' && me && (
            <p className="hidden truncate text-sm text-white/80 lg:block">
              {isDemo ? 'Demo checklist:' : 'Signed in as'} <span className="font-medium text-white">{me.coach.name}</span>
            </p>
          )}
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {isDemo ? <><ViewToggle /><a href="/" className="text-sm underline underline-offset-4">Exit demo</a></> : <><span className="hidden truncate text-sm sm:inline">{email} · {viewMode === 'board' ? 'Board' : access.roleLabel ?? 'Coach'}</span><HelpButton /><ChangePasswordDialog /><button type="button" className="shrink-0 text-sm underline underline-offset-4" onClick={async () => { try { await signOut() } catch { setSignOutError('Unable to sign out. Please try again.') } }}>Sign out</button></>}
          </div>
        </header>
        {isDemo && <p className="border-b bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground lg:px-8"><strong>Read-only board demo.</strong> Five fictional coaches show cleared, incomplete, expiring, expired, and awaiting-review stages. No live records or real certificates.</p>}
        {signOutError && <p role="alert" className="px-4 py-3 text-destructive">{signOutError}</p>}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {preview
            ? (previewTeamView && pathname.startsWith('/team')
                ? children
                : previewSummary ? <CoachSelfView previewSummary={previewSummary} /> : <PreviewNote preview={preview} />)
            : viewMode === 'coach' && !(hasTeamView && pathname.startsWith('/team')) ? <CoachSelfView /> : children}
        </main>
        <footer className="border-t px-4 py-4 text-sm text-muted-foreground lg:px-8">
          Still stuck? Email <a className="font-medium text-primary underline underline-offset-4" href={`mailto:${IT_EMAIL}`}>{IT_EMAIL}</a>
        </footer>
      </div>
    </div>
    </HelpProvider>
  )
}
