// Sends transactional email through Resend. Needs RESEND_API_KEY in the Vercel project environment.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://compliance.svlacrosse.org'
const FROM = process.env.EMAIL_FROM || 'SVLA Coach Compliance <no-reply@mail.svlacrosse.org>'
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

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
