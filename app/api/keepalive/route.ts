import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Called by the Vercel cron in vercel.json every 5 days. Real API traffic keeps the free Supabase project from pausing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  try {
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Database is not configured.' }, { status: 500 })
    const { error, count } = await admin.from('coaches').select('id', { count: 'exact', head: true })
    if (error) throw error
    return NextResponse.json({ ok: true, coaches: count, at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Database check failed.' }, { status: 500 })
  }
}
