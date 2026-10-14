'use client'

import { Hourglass } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { Button } from '@/components/ui/button'

// Shown to a coach whose profile is waiting for (or was not given) board approval.
export function WaitingApprovalPanel() {
  const { email, myStatus, coaches, awaitingCoaches, signOut } = useApp()
  const me = [...coaches, ...awaitingCoaches].find(c => c.email.toLowerCase() === email.toLowerCase())
  const declined = myStatus === 'declined'
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <header className="flex flex-col gap-2">
          <Hourglass className="size-9 text-primary" aria-hidden="true" />
          <h1 className="text-balance text-2xl font-semibold">{declined ? 'Profile not approved' : 'Waiting for board approval'}</h1>
          <p className="leading-relaxed text-muted-foreground">
            {declined
              ? `The board did not approve this profile (${email}). If you think this is a mistake, please contact the SVLA board.`
              : `Thank you${me ? `, ${me.name.split(' ')[0]}` : ''}. Your coach profile has been sent to the SVLA board. They will review your details. We will email ${email} as soon as you are approved, and then you can log in and start your requirements checklist.`}
          </p>
        </header>
        {me && !declined && <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 text-sm"><dt className="text-muted-foreground">Team</dt><dd>{me.team}</dd><dt className="text-muted-foreground">Role</dt><dd>{me.role}</dd></dl>}
        <Button type="button" variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </section>
    </main>
  )
}
