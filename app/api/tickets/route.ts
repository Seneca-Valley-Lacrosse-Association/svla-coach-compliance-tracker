import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendBugAlertEmail, sendTicketEmails } from '@/lib/email'
import { MAX_TICKET_LENGTH, TICKET_STATUSES, TICKET_TOPICS, type AdminTicket, type MyTicket } from '@/lib/tickets'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
const guard = (request: Request) => request.headers.get('x-svla-request') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site'
const clean = z.string().trim().max(200).optional()

const submitSchema = z.object({
  topic: z.enum(TICKET_TOPICS.map(t => t.value) as [string, ...string[]]),
  description: z.string().trim().min(1, 'Describe what you need help with.').max(MAX_TICKET_LENGTH, `Keep it to ${MAX_TICKET_LENGTH} characters or fewer.`),
  context: z.object({ page: clean, item: clean, team: clean, browser: clean }).default({}),
})
const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(TICKET_STATUSES.map(s => s.value) as [string, ...string[]]).optional(),
  note: z.string().max(2000, 'Notes can be up to 2,000 characters.').optional(),
})
const errorMessage = (error: { code?: string; message: string }) =>
  error.code === 'P0001' ? error.message : 'Could not save. Please try again.'

export async function GET() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ error: 'Please sign in again.' }, 401)
    const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
    if (board.error) throw board.error
    if (board.data) {
      const [list, count] = await Promise.all([db.rpc('admin_tickets'), db.rpc('admin_open_ticket_count')])
      if (list.error) throw list.error
      return respond({ role: 'board', mine: [], admin: (list.data ?? []) as AdminTicket[], openCount: typeof count.data === 'number' ? count.data : 0 })
    }
    const mine = await db.rpc('my_tickets')
    if (mine.error) throw mine.error
    return respond({ role: 'coach', mine: (mine.data ?? []) as MyTicket[], admin: [], openCount: 0 })
  } catch {
    return respond({ error: 'Unable to load help requests.' }, 500)
  }
}

// A coach or board member asks for help. The database checks who they are, validates, and rate-limits.
export async function POST(request: Request) {
  if (guard(request)) return respond({ error: 'Request not allowed.' }, 403)
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ error: 'Please sign in again.' }, 401)
    const parsed = submitSchema.safeParse(await request.json())
    if (!parsed.success) return respond({ error: parsed.error.issues[0]?.message ?? 'Check the form values.' }, 400)
    const { topic, description, context } = parsed.data
    const result = await db.rpc('submit_ticket', { p_topic: topic, p_description: description, p_context: context })
    if (result.error) return respond({ error: errorMessage(result.error) }, 400)
    const ticket = Array.isArray(result.data) ? result.data[0] : result.data
    if (!ticket) return respond({ error: 'Could not save your request. Please email it@svlacrosse.org.' }, 500)
    // The ticket is saved either way; email trouble is reported so the person can also write to IT directly.
    const sent = await sendTicketEmails(ticket)
    return respond({ ok: true, ticketCode: ticket.ticket_code, notified: sent.notified, confirmed: sent.confirmed })
  } catch {
    return respond({ error: 'Unable to send your request. Please email it@svlacrosse.org.' }, 500)
  }
}

// Board only (enforced in the database): change status and/or note. Flagging Bug / Issue emails IT once.
export async function PATCH(request: Request) {
  if (guard(request)) return respond({ error: 'Request not allowed.' }, 403)
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ error: 'Please sign in again.' }, 401)
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) return respond({ error: parsed.error.issues[0]?.message ?? 'Check the values.' }, 400)
    const { id, status, note } = parsed.data
    const result = await db.rpc('admin_update_ticket', { p_id: id, p_status: status ?? null, p_note: note ?? null })
    if (result.error) return respond({ error: errorMessage(result.error) }, 400)
    const ticket = Array.isArray(result.data) ? result.data[0] : result.data
    if (!ticket) return respond({ error: 'Ticket not found.' }, 404)
    let bugAlertSent: boolean | undefined
    if (ticket.send_bug_alert) bugAlertSent = await sendBugAlertEmail({ ...ticket, id }, ticket.bug_route_to)
    return respond({ ok: true, ...(bugAlertSent === undefined ? {} : { bugAlertSent }) })
  } catch {
    return respond({ error: 'Unable to update the ticket. Please try again.' }, 500)
  }
}
