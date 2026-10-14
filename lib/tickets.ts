// Shared by the help button, the coach "My requests" list, and the board Help Requests page.
export const IT_EMAIL = 'it@svlacrosse.org'

export const TICKET_TOPICS = [
  { value: 'login', label: "Can't log in" },
  { value: 'clearance_status', label: 'My clearance status looks wrong' },
  { value: 'upload', label: "Can't upload a document" },
  { value: 'broken', label: 'Something is broken' },
  { value: 'other', label: 'Other' },
] as const
export type TicketTopic = (typeof TICKET_TOPICS)[number]['value']
export const topicLabel = (value: string) => TICKET_TOPICS.find(t => t.value === value)?.label ?? value

// bug_issue is internal: coaches never see it (the database shows them "In Progress").
export const TICKET_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'bug_issue', label: 'Bug / Issue' },
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]['value']
export const statusLabel = (value: string) => TICKET_STATUSES.find(s => s.value === value)?.label ?? value

export const MAX_TICKET_LENGTH = 2000

export interface TicketContext { page?: string; item?: string; team?: string; browser?: string }

export interface MyTicket {
  id: string
  ticket_code: string
  topic: string
  description: string
  display_status: 'Open' | 'In Progress' | 'Resolved'
  created_at: string
  resolved_at: string | null
}

export interface AdminTicket {
  id: string
  ticket_code: string
  coach_name: string
  coach_email: string
  topic: string
  description: string
  page_context: TicketContext
  status: TicketStatus
  admin_notes: string | null
  flagged_by_email: string | null
  flagged_at: string | null
  created_at: string
  resolved_at: string | null
}

export interface TicketsSnapshot {
  role: 'board' | 'coach'
  mine: MyTicket[]
  admin: AdminTicket[]
  openCount: number
}
