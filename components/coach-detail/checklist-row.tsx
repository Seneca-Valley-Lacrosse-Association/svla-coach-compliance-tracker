'use client'

import { AlertTriangle, ExternalLink, FileText, LifeBuoy, MessageSquareWarning } from 'lucide-react'
import { daysBetween, eligibilityIssue, formatDate, TODAY, type ChecklistItem } from '@/lib/compliance'
import { LEVEL_LABELS, type Coach, type Submission } from '@/lib/types'
import { reasonFor } from '@/lib/requirement-reasons'
import { ItemStatusPill } from '@/components/status-pill'
import { UploadButton } from './upload-dialog'
import { EditDatesDialog } from './edit-dates-dialog'
import { ReviewActions } from '@/components/review/review-actions'
import { useHelp } from '@/components/help/help-provider'

function relative(date: string) {
  const d = daysBetween(TODAY, date)
  if (d < 0) return `${Math.abs(d)} days ago`
  if (d === 0) return 'today'
  return `in ${d} days`
}

function SubmissionMeta({ sub }: { sub: Submission }) {
  const parts: string[] = []
  if (sub.fbiMethod) parts.push(sub.fbiMethod === 'affidavit' ? 'Volunteer Disclosure Statement' : 'FBI fingerprint results')
  if (sub.obtainedAs) parts.push(`Obtained as: ${sub.obtainedAs}`)
  if (sub.membershipNumber) parts.push(`Member #${sub.membershipNumber}`)
  if (sub.signedName) parts.push(`Signed by ${sub.signedName}`)
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' · ')}</p>
}

export function ChecklistRow({
  item,
  coach,
  mode,
  stepLabel,
}: {
  item: ChecklistItem
  coach: Coach
  mode: 'board' | 'coach'
  stepLabel?: React.ReactNode
}) {
  const { requirement: req, status, latest, approved } = item
  const shown = latest?.status === 'pending' ? latest : approved ?? latest
  const pendingIssue = latest?.status === 'pending' ? eligibilityIssue(coach, req, latest) : null
  const helpOpenByDefault = mode === 'coach' && !item.satisfied
  const reason = reasonFor(req)
  const { openHelp, enabled: helpEnabled } = useHelp()
  // Offer help where people most often get stuck: something missing, pending, rejected, expired or not valid.
  const needsHelpLink = mode === 'coach' && helpEnabled && ['not-started', 'pending', 'rejected', 'expired', 'invalid'].includes(status)

  return (
    <li className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {stepLabel}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-navy">{req.name}</h3>
            <ItemStatusPill status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {req.type}
            {req.appliesToPay.length === 1 && ` · ${req.appliesToPay[0]} coaches only`}
          </p>
          {reason?.source && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Required by:</span> {reason.source}
            </p>
          )}
          {shown && <SubmissionMeta sub={shown} />}
          <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:flex-wrap">
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="font-medium">{formatDate(shown?.completedOn)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="font-medium">
                {shown ? (shown.expiresOn ? formatDate(shown.expiresOn) : 'Never') : '—'}
                {shown?.expiresOn && (status === 'expiring' || status === 'expired') && (
                  <span className={status === 'expired' ? 'text-red-800' : 'text-amber-900'}>
                    {' '}({relative(shown.expiresOn)})
                  </span>
                )}
              </dd>
            </div>
            {latest?.status === 'pending' && (
              <div>
                <dt className="text-muted-foreground">Uploaded</dt>
                <dd className="font-medium">{formatDate(latest.uploadedOn)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {latest?.status === 'pending' && mode === 'board' ? (
            <ReviewActions
              submissionId={latest.id}
              coachName={coach.name}
              requirementName={req.name}
              warning={pendingIssue}
            />
          ) : latest?.status === 'pending' ? (
            <span className="text-sm text-muted-foreground">Waiting for board review</span>
          ) : (
            <UploadButton
              coach={coach}
              requirement={req}
              variant={item.satisfied && status !== 'expiring' ? 'outline' : 'default'}
            />
          )}
          {mode === 'board' && shown && <EditDatesDialog key={`${shown.id}-${shown.completedOn}-${shown.expiresOn}`} submission={shown} requirement={req} />}
          {needsHelpLink && (
            <button
              type="button"
              onClick={() => openHelp({ topic: status === 'not-started' ? 'upload' : 'clearance_status', item: req.name })}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline underline-offset-4"
            >
              <LifeBuoy className="size-4" aria-hidden="true" />
              Question about this?
            </button>
          )}
        </div>
      </div>

      {shown?.editLog && shown.editLog.length > 0 && (
        <details className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-brand">Date corrections ({shown.editLog.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {shown.editLog.map((e, i) => (
              <li key={i} className="leading-relaxed">{formatDate(e.at.slice(0, 10))} by {e.by}: completed {formatDate(e.fromCompletedOn ?? undefined)} → {formatDate(e.toCompletedOn)}{e.note ? ` (${e.note})` : ''}</li>
            ))}
          </ul>
        </details>
      )}

      {shown?.fileName && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/50 p-3 text-sm">
          <FileText className="size-5 shrink-0 text-brand" aria-hidden="true" />
          <span className="truncate">{shown.fileName}</span>
          <span className="ml-auto shrink-0 text-muted-foreground">{shown.filePath ? <span className="flex gap-3"><a href={`/api/documents/${shown.id}?preview=1`} target="_blank" rel="noreferrer" className="text-primary underline">Preview</a><a href={`/api/documents/${shown.id}`} target="_blank" rel="noreferrer" className="text-primary underline">Download document</a></span> : 'Demo only'}</span>
        </div>
      )}

      {(item.issue || pendingIssue) && (
        <p className="flex gap-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {pendingIssue ?? item.issue}
        </p>
      )}

      {latest?.status === 'rejected' && latest.reviewComment && (
        <p className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <MessageSquareWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">Rejected {formatDate(latest.reviewedOn)}:</span> {latest.reviewComment}
          </span>
        </p>
      )}

      <details className="group rounded-lg bg-secondary/60 px-3 py-2 text-sm" open={helpOpenByDefault}>
        <summary className="cursor-pointer font-medium text-brand">How to get this</summary>
        <p className="mt-2 leading-relaxed text-foreground">{req.help}</p>
        {req.helpUrl && <a
          href={req.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 font-medium text-brand underline underline-offset-4"
        >
          {req.helpLinkLabel}
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>}
      </details>

      {reason && (
        <details className="group rounded-lg bg-secondary/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-brand">Why we require this</summary>
          <p className="mt-2 font-medium text-navy">{LEVEL_LABELS[reason.level]}</p>
          <p className="mt-1 leading-relaxed text-foreground">{reason.why}</p>
          {reason.source && (
            <p className="mt-2 leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Where it comes from:</span> {reason.source}
            </p>
          )}
          {reason.sourceUrl && (
            <a
              href={reason.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-medium text-brand underline underline-offset-4"
            >
              Read the source
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </details>
      )}
    </li>
  )
}
