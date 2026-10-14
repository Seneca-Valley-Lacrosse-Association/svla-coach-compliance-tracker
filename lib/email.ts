// Sends transactional email through Resend. Needs RESEND_API_KEY in the Vercel project environment.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://compliance.svlacrosse.org'
const FROM = process.env.EMAIL_FROM || 'SVLA Coach Compliance <no-reply@mail.svlacrosse.org>'
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Onboarding email with a one-time link to set a password. Returns true when Resend accepted it. Never throws. */
export async function sendInviteEmail(to: string, name: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const first = name.trim().split(/\s+/)[0] || 'coach'
  const text = `Hi ${first},\n\nSeneca Valley Lacrosse Association is tracking required clearances and certifications for everyone who works with our players. You have been added, and your account is ready to set up:\n\n${link}\n\nThe link works once and expires, and it is for you only, so please do not forward it. If it stops working, ask the board to send a new one.\n\nAfter you choose a password, your checklist shows exactly which items apply to you, with step-by-step links for each. You can upload your documents there instead of emailing them.\n\nYour account is tied to this email address (${to}). Questions? Reply to this message.\n\nThank you for coaching with Seneca Valley Lacrosse Association.`
  const html = `<p>Hi ${escapeHtml(first)},</p><p>Seneca Valley Lacrosse Association is tracking required clearances and certifications for everyone who works with our players. You have been added, and your account is ready to set up:</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#17558a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Set up my account</a></p><p>The link works once and expires, and it is for you only, so please do not forward it. If it stops working, ask the board to send a new one.</p><p>After you choose a password, your checklist shows exactly which items apply to you, with step-by-step links for each. You can upload your documents there instead of emailing them.</p><p>Your account is tied to this email address (${escapeHtml(to)}). Questions? Reply to this message.</p><p>Thank you for coaching with Seneca Valley Lacrosse Association.</p>`
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: process.env.EMAIL_REPLY_TO || 'it@svlacrosse.org', subject: 'Set up your SVLA Coach Compliance account', text, html }),
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
  const text = `Hi ${first},\n\nThe SVLA board has approved your coach profile. You can log in now and see your requirements checklist:\n\n${SITE_URL}\n\nSign in with the email and password you created (${to}). Use "Forgot password" on the sign-in page if you need to reset it.\n\nThank you for coaching with Seneca Valley Lacrosse Association.`
  const html = `<p>Hi ${escapeHtml(first)},</p><p>The SVLA board has approved your coach profile. You can log in now and see your requirements checklist:</p><p><a href="${SITE_URL}">${SITE_URL}</a></p><p>Sign in with the email and password you created (${escapeHtml(to)}). Use &ldquo;Forgot password&rdquo; on the sign-in page if you need to reset it.</p><p>Thank you for coaching with Seneca Valley Lacrosse Association.</p>`
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: 'You are approved: log in to SVLA Coach Compliance', text, html }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch { return false }
}
