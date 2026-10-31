import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchSurveys } from '@/lib/survey-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Called once a day by the Vercel cron in vercel.json. Opens coaching surveys on their send date, sends
// invitations and reminders according to each survey's settings, and closes surveys after their close date.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Database is not configured.' }, { status: 500 })
  try {
    const result = await dispatchSurveys(admin)
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Survey run failed.' }, { status: 500 })
  }
}
