import ExcelJS from 'exceljs'
import { appliesTo, summarizeCoach, TODAY } from './compliance'
import type { Coach, ItemStatus, Requirement, Submission } from './types'

const ITEM_LABEL: Record<ItemStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  pending: 'Pending review',
  approved: 'Approved',
  expiring: 'Expiring soon',
  expired: 'Expired',
  rejected: 'Rejected',
  invalid: 'Not valid for role',
}
const FILL: Record<string, string> = {
  Approved: 'FFD1FAE5', 'Expiring soon': 'FFFDE68A', Expired: 'FFFECACA', Rejected: 'FFFECACA',
  'Not valid for role': 'FFFED7AA', 'Pending review': 'FFBAE6FD', 'Not started': 'FFE2E8F0', 'In progress': 'FFDDD6FE',
  Cleared: 'FFD1FAE5', Incomplete: 'FFE2E8F0', Expiring: 'FFFDE68A',
}
const HEADER_FILL = 'FF0F2A4A'

export interface ExportInput {
  coaches: Coach[]
  requirements: Requirement[]
  submissions: Submission[]
  /** Site origin, used to build document links, e.g. https://compliance.svlacrosse.org */
  origin: string
  generatedBy?: string
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', wrapText: true }
  row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } })
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }]
  if (sheet.columnCount > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } }
}
function tint(cell: ExcelJS.Cell, label: string) {
  const argb = FILL[label]
  if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
const text = (value: string | null | undefined) => value ?? ''

export async function buildWorkbook({ coaches, requirements, submissions, origin, generatedBy }: ExportInput) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SVLA Compliance Tracker'
  wb.created = new Date()
  const reqs = [...requirements].sort((a, b) => a.order - b.order)
  const activeReqs = reqs.filter((r) => r.active)
  const coachName = new Map(coaches.map((c) => [c.id, c.name]))
  const reqName = new Map(reqs.map((r) => [r.id, r.name]))
  const summaries = coaches.map((c) => summarizeCoach(c, requirements, submissions))

  // ---- Read Me
  const readme = wb.addWorksheet('Read Me')
  readme.columns = [{ width: 110 }]
  ;[
    'SVLA Compliance: full data export',
    `Generated ${TODAY}${generatedBy ? ` by ${generatedBy}` : ''}. Contains personal information about coaches. Store it securely and share only with SVLA board members.`,
    '',
    'Sheets in this file:',
    '  Coaches: roster with contact details, team, role, paid or volunteer status. Archived coaches are included with an Archived on date.',
    '  Compliance Matrix: one row per coach, one column per active requirement, showing current status and expiry date.',
    '  Submissions: every upload, signature, or membership entry ever submitted, including review decisions, comments, and any date corrections made by the board.',
    '  Requirements: the list of requirements and the rules for who each one applies to.',
    '',
    'Uploaded certificate files are stored separately in the Supabase "certificates" bucket. The Submissions sheet lists each file name and a link that works while the app is running and you are signed in as a board member.',
    'Statuses are calculated on the export date. Expiring soon means within 60 days.',
  ].forEach((line, i) => {
    const cell = readme.getCell(i + 1, 1)
    cell.value = line
    cell.alignment = { wrapText: true, vertical: 'top' }
    if (i === 0) cell.font = { bold: true, size: 14 }
  })

  // ---- Coaches
  const cs = wb.addWorksheet('Coaches')
  cs.columns = [
    { header: 'Name', key: 'name', width: 26 }, { header: 'Email', key: 'email', width: 32 },
    { header: 'Phone', key: 'phone', width: 18 }, { header: 'Team', key: 'team', width: 12 },
    { header: 'Role', key: 'role', width: 20 }, { header: 'Paid / Volunteer', key: 'pay', width: 16 },
    { header: 'PA resident 10 years', key: 'pa', width: 20 }, { header: 'Overall status', key: 'status', width: 16 },
    { header: 'Requirements met', key: 'met', width: 18 }, { header: 'Missing or out of date', key: 'missing', width: 60 }, { header: 'Archived on', key: 'archived', width: 14 },
  ]
  summaries.forEach((s) => {
    const label = s.status === 'cleared' ? 'Cleared' : s.status === 'expiring' ? 'Expiring' : s.status === 'expired' ? 'Expired' : 'Incomplete'
    const row = cs.addRow({
      name: s.coach.name, email: s.coach.email, phone: s.coach.phone, team: s.coach.team, role: s.coach.role,
      pay: s.coach.pay, pa: s.coach.paResident10Years ? 'Yes' : 'No', status: label,
      met: `${s.satisfiedCount} of ${s.total}`, missing: s.missing.map((m) => m.requirement.name).join('; '), archived: s.coach.archivedAt ? s.coach.archivedAt.slice(0, 10) : '',
    })
    tint(row.getCell('status'), label)
  })
  styleHeader(cs)

  // ---- Compliance Matrix
  const mx = wb.addWorksheet('Compliance Matrix')
  mx.columns = [
    { header: 'Name', key: 'name', width: 26 }, { header: 'Team', key: 'team', width: 12 },
    { header: 'Role', key: 'role', width: 20 }, { header: 'Paid / Volunteer', key: 'pay', width: 16 },
    ...activeReqs.map((r) => ({ header: r.name, key: r.id, width: 26 })),
  ]
  summaries.forEach((s) => {
    const row = mx.addRow({ name: s.coach.name, team: s.coach.team, role: s.coach.role, pay: s.coach.pay })
    activeReqs.forEach((r) => {
      const cell = row.getCell(r.id)
      if (!appliesTo(r, s.coach)) { cell.value = 'Not required'; cell.font = { color: { argb: 'FF94A3B8' } }; return }
      const item = s.items.find((i) => i.requirement.id === r.id)
      if (!item) { cell.value = r.required ? 'Not started' : 'Optional'; return }
      const label = ITEM_LABEL[item.status]
      const expiry = item.approved?.expiresOn
      cell.value = expiry && (item.status === 'approved' || item.status === 'expiring' || item.status === 'expired') ? `${label} (expires ${expiry})` : label
      tint(cell, label)
    })
  })
  styleHeader(mx)
  mx.getRow(1).height = 45

  // ---- Submissions
  const sb = wb.addWorksheet('Submissions')
  sb.columns = [
    { header: 'Coach', key: 'coach', width: 26 }, { header: 'Requirement', key: 'req', width: 38 },
    { header: 'Status', key: 'status', width: 12 }, { header: 'Completed on', key: 'completed', width: 14 },
    { header: 'Expires on', key: 'expires', width: 14 }, { header: 'Uploaded on', key: 'uploaded', width: 14 },
    { header: 'Reviewed on', key: 'reviewed', width: 14 }, { header: 'Review comment', key: 'comment', width: 40 },
    { header: 'Obtained as', key: 'obtained', width: 14 }, { header: 'FBI method', key: 'fbi', width: 14 },
    { header: 'Membership number', key: 'member', width: 20 }, { header: 'Signed name', key: 'signed', width: 22 },
    { header: 'File name', key: 'file', width: 34 }, { header: 'Document link', key: 'link', width: 22 }, { header: 'Date edit history', key: 'edits', width: 60 },
  ]
  const ordered = [...submissions].sort((a, b) =>
    text(coachName.get(a.coachId)).localeCompare(text(coachName.get(b.coachId))) || a.requirementId.localeCompare(b.requirementId) || b.uploadedOn.localeCompare(a.uploadedOn))
  ordered.forEach((s) => {
    const row = sb.addRow({
      coach: text(coachName.get(s.coachId)), req: text(reqName.get(s.requirementId)) || s.requirementId,
      status: s.status[0].toUpperCase() + s.status.slice(1), completed: s.completedOn, expires: s.expiresOn ?? '',
      uploaded: s.uploadedOn, reviewed: text(s.reviewedOn), comment: text(s.reviewComment),
      obtained: text(s.obtainedAs), fbi: text(s.fbiMethod), member: text(s.membershipNumber),
      signed: text(s.signedName), file: text(s.fileName), link: '',
      edits: (s.editLog ?? []).map((e) => `${e.at.slice(0, 10)} by ${e.by}: completed ${e.fromCompletedOn ?? '—'} → ${e.toCompletedOn}, expires ${e.fromExpiresOn ?? '—'} → ${e.toExpiresOn ?? 'never'}${e.note ? ` (${e.note})` : ''}`).join('\n'),
    })
    if (s.filePath) row.getCell('link').value = { text: 'Open document', hyperlink: `${origin}/api/documents/${s.id}` }
    tint(row.getCell('status'), s.status === 'approved' ? 'Approved' : s.status === 'rejected' ? 'Rejected' : 'Pending review')
  })
  styleHeader(sb)

  // ---- Requirements
  const rq = wb.addWorksheet('Requirements')
  rq.columns = [
    { header: 'Order', key: 'order', width: 8 }, { header: 'Requirement', key: 'name', width: 44 },
    { header: 'Type', key: 'type', width: 12 }, { header: 'Active', key: 'active', width: 10 },
    { header: 'Required', key: 'required', width: 10 }, { header: 'Applies to roles', key: 'roles', width: 44 },
    { header: 'Applies to', key: 'pay', width: 18 }, { header: 'Valid for', key: 'validity', width: 22 },
    { header: 'Instructions', key: 'help', width: 70 }, { header: 'Link', key: 'url', width: 40 },
  ]
  reqs.forEach((r) => {
    const v = r.validity
    rq.addRow({
      order: r.order, name: r.name, type: r.type, active: r.active ? 'Yes' : 'No', required: r.required ? 'Yes' : 'No',
      roles: r.appliesToRoles.join(', '), pay: r.appliesToPay.join(' and '),
      validity: v.kind === 'years' ? `${v.years} year${v.years === 1 ? '' : 's'}` : v.kind === 'school-year' ? 'School year (ends June 30)' : v.kind === 'membership' ? 'Membership term' : 'One-time',
      help: r.help, url: r.helpUrl,
    })
  })
  styleHeader(rq)
  rq.eachRow((row) => row.alignment = { vertical: 'top', wrapText: true })

  return wb
}
