'use client'

import { Archive } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { Button } from '@/components/ui/button'

// Shown to a coach whose record the board archived. Their history is kept; they have no active checklist.
export function ArchivedPanel() {
  const { email, signOut } = useApp()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <header className="flex flex-col gap-2">
          <Archive className="size-9 text-primary" aria-hidden="true" />
          <h1 className="text-balance text-2xl font-semibold">Coach record archived</h1>
          <p className="leading-relaxed text-muted-foreground">The SVLA board has archived the coach record for {email}. Your past submissions are kept on file. If you are coaching again, please contact the SVLA board and they can restore your record.</p>
        </header>
        <Button type="button" variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </section>
    </main>
  )
}
