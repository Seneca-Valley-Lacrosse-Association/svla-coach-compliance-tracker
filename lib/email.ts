// Sends transactional email through Resend. Needs RESEND_API_KEY in the Vercel project environment.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://compliance.svlacrosse.org'
const FROM = process.env.EMAIL_FROM || 'SVLA Compliance <no-reply@mail.svlacrosse.org>'
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Onboarding email with a one-time link to set a password. Returns true when Resend accepted it. Never throws. */
export async function sendInviteEmail(to: string, name: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const first = name.trim().split(/\s+/)[0] || 'coach'
  const text = `Hi ${first},\n\nSeneca Valley Lacrosse Association is tracking required clearances and certifications for everyone who works with our players. You have been added, and your account is ready to set up:\n\n${link}\n\nThe link works once and expires, and it is for you only, so please do not forward it. If it stops working, ask the board to send a new one.\n\nIf this address is a Google account (Gmail or an svlacrosse.org address), you can skip the password: go to compliance.svlacrosse.org and choose Continue with Google.\n\nOnce you are in, your checklist shows exactly which items apply to you, with step-by-step links for each. You can upload your documents there instead of emailing them.\n\nYour account is tied to this email address (${to}). Questions? Reply to this message.\n\nThank you for coaching with Seneca Valley Lacrosse Association.`
  const html = `<p>Hi ${escapeHtml(first)},</p><p>Seneca Valley Lacrosse Association is tracking required clearances and certifications for everyone who works with our players. You have been added, and your account is ready to set up:</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#17558a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Set up my account</a></p><p>The link works once and expires, and it is for you only, so please do not forward it. If it stops working, ask the board to send a new one.</p><p>If this address is a Google account (Gmail or an svlacrosse.org address), you can skip the password: go to <a href="${SITE_URL}">compliance.svlacrosse.org</a> and choose Continue with Google.</p><p>Once you are in, your checklist shows exactly which items apply to you, with step-by-step links for each. You can upload your documents there instead of emailing them.</p><p>Your account is tied to this email address (${escapeHtml(to)}). Questions? Reply to this message.</p><p>Thank you for coaching with Seneca Valley Lacrosse Association.</p>`
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: process.env.EMAIL_REPLY_TO || 'it@svlacrosse.org', subject: 'Set up your SVLA Compliance account', text, html }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch { return false }
}

/** Board onboarding email with a one-time link to set a password. Returns true when Resend accepted it. Never throws. */
export async function sendBoardInviteEmail(to: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const text = `Hello,\n\nYou have been given board access to the Seneca Valley Lacrosse Association compliance tracker, where coach clearances and certifications are reviewed. Set up your account here:\n\n${link}\n\nThe link works once and expires, and it is for you only, so please do not forward it. If it stops working, ask another board member to send a new one.\n\nIf this address is a Google account (Gmail or an svlacrosse.org address), you can skip the password: go to compliance.svlacrosse.org and choose Continue with Google.\n\nYour account is tied to this email address (${to}). Questions? Reply to this message.\n\nThank you for serving Seneca Valley Lacrosse Association.`
  const html = `<p>Hello,</p><p>You have been given board access to the Seneca Valley Lacrosse Association compliance tracker, where coach clearances and certifications are reviewed. Set up your account here:</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#17558a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Set up my account</a></p><p>The link works once and expires, and it is for you only, so please do not forward it. If it stops working, ask another board member to send a new one.</p><p>If this address is a Google account (Gmail or an svlacrosse.org address), you can skip the password: go to <a href="${SITE_URL}">compliance.svlacrosse.org</a> and choose Continue with Google.</p><p>Your account is tied to this email address (${escapeHtml(to)}). Questions? Reply to this message.</p><p>Thank you for serving Seneca Valley Lacrosse Association.</p>`
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: process.env.EMAIL_REPLY_TO || 'it@svlacrosse.org', subject: 'Set up your SVLA Compliance board account', text, html }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch { return false }
}

/** Returns true when Resend accepted the message. Never throws. */
export async function sendApprovalEmail(to: string, name: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const first = name.trim().split(/\s+/)[0] || 'coach'
  const text = `Hi ${first},\n\nThe SVLA board has approved your coach profile. You can log in now and see your requirements checklist:\n\n${SITE_URL}\n\nSign in with Continue with Google, or with the email and password you created (${to}). Use "Forgot password" on the sign-in page if you need to reset a password.\n\nThank you for coaching with Seneca Valley Lacrosse Association.`
  const html = `<p>Hi ${escapeHtml(first)},</p><p>The SVLA board has approved your coach profile. You can log in now and see your requirements checklist:</p><p><a href="${SITE_URL}">${SITE_URL}</a></p><p>Sign in with &ldquo;Continue with Google,&rdquo; or with the email and password you created (${escapeHtml(to)}). Use &ldquo;Forgot password&rdquo; on the sign-in page if you need to reset a password.</p><p>Thank you for coaching with Seneca Valley Lacrosse Association.</p>`
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: 'You are approved: log in to SVLA Compliance', text, html }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch { return false }
}

const IT = 'it@svlacrosse.org'
const TOPIC_LABELS: Record<string, string> = {
  login: "Can't log in",
  clearance_status: 'Clearance status looks wrong',
  upload: "Can't upload a document",
  broken: 'Something is broken',
  other: 'Other',
}

interface TicketForEmail {
  ticket_code: string
  topic: string
  description: string
  page_context: { page?: string; item?: string; team?: string; browser?: string } | null
}

function contextLines(ctx: TicketForEmail['page_context']): [string, string][] {
  const c = ctx ?? {}
  return ([['Page', c.page], ['Item', c.item], ['Team', c.team], ['Browser', c.browser]] as [string, string | undefined][]).filter((l): l is [string, string] => !!l[1])
}

async function sendMail(to: string, subject: string, text: string, html: string, replyTo?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch { return false }
}

/** New help request: notify the routed address (IT for now, reply-to the coach), then confirm to the coach. Never throws. */
export async function sendTicketEmails(
  t: TicketForEmail & { id: string; coach_name: string; coach_email: string; route_to: string },
): Promise<{ notified: boolean; confirmed: boolean }> {
  const label = TOPIC_LABELS[t.topic] ?? t.topic
  const ctx = contextLines(t.page_context)
  const link = `${SITE_URL}/tickets?ticket=${encodeURIComponent(t.id)}`
  const text = `${t.ticket_code} - ${label}\nFrom: ${t.coach_name} (${t.coach_email})\n\n${t.description}\n\n${ctx.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nAdmin view: ${link}\n\nReply to this email to respond directly to the coach.`
  const html = `<p><strong>${escapeHtml(t.ticket_code)}</strong> &mdash; ${escapeHtml(label)}</p><p><strong>From:</strong> ${escapeHtml(t.coach_name)} (${escapeHtml(t.coach_email)})</p><p style="white-space:pre-wrap">${escapeHtml(t.description)}</p>${ctx.length ? `<p><strong>Context</strong><br>${ctx.map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join('<br>')}</p>` : ''}<p><a href="${escapeHtml(link)}">Open in the Help Requests page</a></p><p style="color:#666">Reply to this email to respond directly to the coach.</p>`
  const notified = await sendMail(t.route_to, `[SVLA Help] ${t.ticket_code}: ${label}`, text, html, t.coach_email)
  await new Promise(resolve => setTimeout(resolve, 600)) // Resend allows about 2 emails per second.
  const first = t.coach_name.trim().split(/\s+/)[0] || 'there'
  const confirmText = `Hi ${first},\n\nWe received your request and our IT team will follow up. Your ticket ID is ${t.ticket_code}.\n\nIf you need to add anything, reply to this email or write to ${IT} and include the ticket ID.\n\nPlease do not send SSNs or copies of clearance documents by email.\n\nSVLA`
  const confirmHtml = `<p>Hi ${escapeHtml(first)},</p><p>We received your request and our IT team will follow up. Your ticket ID is <strong>${escapeHtml(t.ticket_code)}</strong>.</p><p>If you need to add anything, reply to this email or write to ${IT} and include the ticket ID.</p><p>Please do not send SSNs or copies of clearance documents by email.</p><p>SVLA</p>`
  const confirmed = await sendMail(t.coach_email, `We received your request (${t.ticket_code})`, confirmText, confirmHtml, IT)
  return { notified, confirmed }
}

/** One-time alert when a board member flags a ticket as Bug / Issue. Deliberately omits the coach's name and email. Never throws. */
export async function sendBugAlertEmail(
  t: TicketForEmail & { id: string; admin_notes: string | null; flagged_by_email: string | null },
  to: string,
): Promise<boolean> {
  const label = TOPIC_LABELS[t.topic] ?? t.topic
  const ctx = contextLines(t.page_context)
  const link = `${SITE_URL}/tickets?ticket=${encodeURIComponent(t.id)}`
  const text = `${t.ticket_code} flagged as Bug / Issue - ${label}\nFlagged by: ${t.flagged_by_email ?? 'a board member'}\n${t.admin_notes ? `Admin note: ${t.admin_notes}\n` : ''}\n${t.description}\n\n${ctx.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nTicket: ${link}`
  const html = `<p><strong>${escapeHtml(t.ticket_code)}</strong> flagged as Bug / Issue &mdash; ${escapeHtml(label)}</p><p><strong>Flagged by:</strong> ${escapeHtml(t.flagged_by_email ?? 'a board member')}</p>${t.admin_notes ? `<p><strong>Admin note:</strong> ${escapeHtml(t.admin_notes)}</p>` : ''}<p style="white-space:pre-wrap"><strong>Description</strong><br>${escapeHtml(t.description)}</p>${ctx.length ? `<p><strong>Context</strong><br>${ctx.map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join('<br>')}</p>` : ''}<p><a href="${escapeHtml(link)}">Open ticket</a></p>`
  return sendMail(to, `[SVLA BUG] ${t.ticket_code}: ${label}`, text, html)
}

/** Coaching survey invitation or reminder. Returns true when Resend accepted it. Never throws. */
export async function sendSurveyEmail(
  kind: 'invite' | 'reminder' | 'due_tomorrow' | 'overdue',
  to: string,
  name: string,
  survey: { title: string; dueOn: string; dueLabel: string; intro: string },
): Promise<boolean> {
  const first = name.trim().split(/\s+/)[0] || 'Coach'
  const link = `${SITE_URL}/survey`
  const subjects = {
    invite: `${survey.title}: please respond by ${survey.dueLabel}`,
    reminder: `Reminder: ${survey.title} is due ${survey.dueLabel}`,
    due_tomorrow: `Due tomorrow: ${survey.title}`,
    overdue: `Still time to respond: ${survey.title}`,
  }
  const openers = {
    invite: 'The SVLA Board of Directors is asking every coach for feedback on the season. Your answers help us improve the experience for players, families and coaches.',
    reminder: `This is a friendly reminder that the ${survey.title} is due ${survey.dueLabel}. We have not received your response yet.`,
    due_tomorrow: `The ${survey.title} is due tomorrow, ${survey.dueLabel}. We have not received your response yet.`,
    overdue: `The ${survey.title} was due ${survey.dueLabel}, and we would still very much like to hear from you.`,
  }
  const intro = kind === 'invite' && survey.intro.trim() ? survey.intro.trim() : ''
  const text = `Hi ${first},\n\n${openers[kind]}\n\n${intro ? `${intro}\n\n` : ''}Take the survey here (about 10 minutes; you can save and finish later):\n${link}\n\nSign in with your SVLA Compliance account (${to}). If you have not set a password yet, use "Forgot password" on the sign-in page.\n\nThank you for coaching with Seneca Valley Lacrosse Association.`
  const html = `<p>Hi ${escapeHtml(first)},</p><p>${escapeHtml(openers[kind])}</p>${intro ? `<p style="white-space:pre-wrap">${escapeHtml(intro)}</p>` : ''}<p><a href="${link}" style="display:inline-block;background:#17558a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Take the survey</a></p><p>It takes about 10 minutes, and you can save and finish later. Please respond by <strong>${escapeHtml(survey.dueLabel)}</strong>.</p><p>Sign in with your SVLA Compliance account (${escapeHtml(to)}). If you have not set a password yet, use &ldquo;Forgot password&rdquo; on the sign-in page.</p><p>Thank you for coaching with Seneca Valley Lacrosse Association.</p>`
  return sendMail(to, subjects[kind], text, html, process.env.EMAIL_REPLY_TO || IT)
}
