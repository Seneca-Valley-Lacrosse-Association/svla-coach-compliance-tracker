'use client'

import Link from '@/components/app-link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Menu,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { useApp, type ViewMode } from '@/lib/app-store'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { CoachSelfView } from './coach-self-view'
import { ChangePasswordDialog } from './change-password-dialog'

const boardNav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/review', label: 'Review Queue', icon: Inbox },
  { href: '/requirements', label: 'Requirements', icon: ListChecks },
  { href: '/coaches', label: 'Coaches', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/board', label: 'Board Access', icon: UserCog },
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
        <p className="text-sm text-sidebar-foreground/80">Coach Compliance</p>
      </div>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { viewMode, summaries, isDemo } = useApp()
  const pendingCount = summaries.reduce(
    (n, s) => n + s.items.filter((i) => i.latest?.status === 'pending').length,
    0,
  )

  if (viewMode === 'coach') {
    return (
      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        <span className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5 font-medium text-white">
          <ClipboardCheck className="size-5" aria-hidden="true" />
          My Checklist
        </span>
      </nav>
    )
  }

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {boardNav.filter(({ href }) => !(isDemo && href === '/board')).map(({ href, label, icon: Icon }) => {
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { viewMode, getSummary, currentCoachId, isDemo, email, signOut } = useApp()
  const [signOutError, setSignOutError] = useState('')
  const me = getSummary(currentCoachId)

  return (
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-navy px-4 text-white lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 hover:bg-white/10 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <p className="truncate font-semibold lg:hidden">SVLA Coach Compliance</p>
          {viewMode === 'coach' && me && (
            <p className="hidden truncate text-sm text-white/80 lg:block">
              {isDemo ? 'Demo checklist:' : 'Signed in as'} <span className="font-medium text-white">{me.coach.name}</span>
            </p>
          )}
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {isDemo ? <><ViewToggle /><a href="/" className="text-sm underline underline-offset-4">Exit demo</a></> : <><span className="hidden truncate text-sm sm:inline">{email} · {viewMode === 'board' ? 'Board' : 'Coach'}</span><ChangePasswordDialog /><button type="button" className="shrink-0 text-sm underline underline-offset-4" onClick={async () => { try { await signOut() } catch { setSignOutError('Unable to sign out. Please try again.') } }}>Sign out</button></>}
          </div>
        </header>
        {isDemo && <p className="border-b bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground lg:px-8"><strong>Read-only board demo.</strong> Five fictional coaches show cleared, incomplete, expiring, expired, and awaiting-review stages. No live records or real certificates.</p>}
        {signOutError && <p role="alert" className="px-4 py-3 text-destructive">{signOutError}</p>}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {viewMode === 'coach' ? <CoachSelfView /> : children}
        </main>
      </div>
    </div>
  )
}
