import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { NO_ACCESS, type AccessInfo, type StaffData } from '@/lib/types'

export const dynamic = 'force-dynamic'
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

/**
 * Board-only, read-only "preview as". Returns what the given person would see under the role system.
 * It never signs in as that person: the database functions compute their view for the board caller,
 * and refuse anyone who is not a board member.
 */
export async function GET(request: Request) {
  try {
    const email = z.string().trim().toLowerCase().email().max(254).safeParse(new URL(request.url).searchParams.get('email'))
    if (!email.success) return respond({ error: 'Enter a valid email address.' }, 400)
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ error: 'Please sign in again.' }, 401)
    const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
    if (board.error || !board.data) return respond({ error: 'Board access is required.' }, 403)
    const access = await db.rpc('preview_access', { p_email: email.data })
    if (access.error) throw access.error
    const info = (access.data ?? NO_ACCESS) as AccessInfo
    let staff: StaffData = { roster: [], status: [] }
    if (!info.isBoard && (info.views.clearance_status || info.views.staff_roster)) {
      const [roster, status] = await Promise.all([db.rpc('preview_staff_roster', { p_email: email.data }), db.rpc('preview_staff_status', { p_email: email.data })])
      if (roster.error || status.error) throw roster.error ?? status.error
      staff = { roster: roster.data ?? [], status: status.data ?? [] }
    }
    const coach = await db.from('coaches').select('name').eq('email', email.data).maybeSingle()
    return respond({ email: email.data, name: coach.data?.name ?? null, access: info, staff })
  } catch {
    return respond({ error: 'Unable to load the preview. Please try again.' }, 500)
  }
}
