'use client'

import { AlertTriangle, CheckCircle2, Circle, Clock, ExternalLink, FileText, Hourglass, LifeBuoy, MessageSquareWarning } from 'lucide-react'
import { daysBetween, daysInProgress, eligibilityIssue, fbiCodeLines, followUpOverdue, formatDate, isFbiRequirement, TODAY, type ChecklistItem, type FbiCodeLine } from '@/lib/compliance'
import { useApp } from '@/lib/app-store'
import { FBI_CHECK_SHORT, LEVEL_LABELS, PROGRAM_LABELS, type Coach, type Submission } from '@/lib/types'
import { reasonFor } from '@/lib/requirement-reasons'
import { ItemStatusPill } from '@/components/status-pill'
import { UploadButton } from './upload-dialog'
import { InProgressButton } from './in-progress-dialog'
import { EditDatesDialog } from './edit-dates-dialog'
import { RemoveEntryDialog } from './remove-entry-dialog'
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
  if (sub.fbiCheck) parts.push(FBI_CHECK_SHORT[sub.fbiCheck])
  else if (sub.fbiMethod) parts.push(sub.fbiMethod === 'affidavit' ? 'Volunteer Disclosure Statement' : 'FBI fingerprint results')
  if (sub.obtainedAs && !sub.fbiCheck) parts.push(`Obtained as: ${sub.obtainedAs}`)
  if (sub.membershipNumber) parts.push(`Member #${sub.membershipNumber}`)
  if (sub.signedName) parts.push(`Signed by ${sub.signedName}`)
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' · ')}</p>
}

const CODE_STATE = {
  'on-file': { icon: CheckCircle2, tone: 'text-emerald-800', iconTone: 'text-emerald-600', text: 'on file' },
  expiring: { icon: Clock, tone: 'text-amber-900', iconTone: 'text-amber-600', text: 'on file, expiring soon' },
  pending: { icon: Hourglass, tone: 'text-sky-900', iconTone: 'text-brand', text: 'uploaded, waiting for board review' },
  needed: { icon: Circle, tone: 'text-red-900', iconTone: 'text-red-600', text: 'still needed' },
} as const

/** The FBI service code(s) this coach needs, one line per program, with what is already on file. */
function FbiCodes({ lines }: { lines: FbiCodeLine[] }) {
  if (lines.length === 0) return null
  return (
    <div className="mt-1 rounded-lg border border-brand/30 bg-sky-50/70 p-3 text-sm" aria-label="Your FBI service codes">
      <p className="font-semibold text-navy">
        {lines.length > 1 ? 'Your codes (you coach both programs, so you need one for each)' : 'Your code'}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {lines.map((l) => {
          const st = CODE_STATE[l.state]
          const Icon = st.icon
          return (
            <li key={l.program} className="flex items-start gap-2">
              <Icon className={`mt-0.5 size-4 shrink-0 ${st.iconTone}`} aria-hidden="true" />
              <span className={st.tone}>
                <span className="font-medium text-foreground">{PROGRAM_LABELS[l.program]}:</span>{' '}
                <span className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold text-navy ring-1 ring-brand/30">{l.code}</span>{' '}
                <span className="text-muted-foreground">({l.codeName})</span>
                {l.alternative && l.state === 'needed' && <span className="text-muted-foreground"> {l.alternative}</span>}
                {' · '}{st.text}{l.expiresOn ? `, expires ${formatDate(l.expiresOn)}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-muted-foreground">Give IdentoGO this code when you register. Details are under How to get this.</p>
    </div>
  )
}

export function ChecklistRow({
  item,
  coach,
  mode,
  stepLabel,
  readOnly = false,
}: {
  item: ChecklistItem
  coach: Coach
  mode: 'board' | 'coach'
  stepLabel?: React.ReactNode
  /** Preview mode: show everything the person sees, but offer no actions. */
  readOnly?: boolean
}) {
  const { requirement: req, status, latest, approved } = item
  const { submissions, progress: progressRows } = useApp()
  const codeLines = isFbiRequirement(req) ? fbiCodeLines(coach, req, submissions, progressRows) : []
  const shown = latest?.status === 'pending' ? latest : approved ?? latest
  const pendingIssue = latest?.status === 'pending' ? eligibilityIssue(coach, req, latest) : null
  const helpOpenByDefault = mode === 'coach' && !item.satisfied
  const reason = reasonFor(req)
  const progress = item.progress
  const canMarkStarted = latest?.status !== 'pending' && ['not-started', 'in-progress', 'rejected', 'expired', 'expiring'].includes(status)
  const showProgress = !!progress && latest?.status !== 'pending' && status !== 'approved' && status !== 'invalid'
  const { openHelp, enabled: helpEnabled } = useHelp()
  // Offer help where people most often get stuck: something missing, pending, rejected, expired or not valid.
  const needsHelpLink = !readOnly && mode === 'coach' && helpEnabled && ['not-started', 'in-progress', 'pending', 'rejected', 'expired', 'invalid'].includes(status)

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
          {codeLines.length > 0 && <FbiCodes lines={codeLines} />}
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
          ) : readOnly ? null : (
            <UploadButton
              coach={coach}
              requirement={req}
              variant={item.satisfied && status !== 'expiring' ? 'outline' : 'default'}
            />
          )}
          {!readOnly && canMarkStarted && <InProgressButton key={`${progress?.startedOn}-${progress?.followUpOn}-${progress?.note}`} coach={coach} requirement={req} progress={progress} />}
          {mode === 'board' && shown && <EditDatesDialog key={`${shown.id}-${shown.completedOn}-${shown.expiresOn}`} submission={shown} requirement={req} />}
          {!readOnly && shown && <RemoveEntryDialog submission={shown} requirementName={req.name} mode={mode} />}
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

      {showProgress && progress && (
        <p className="flex gap-2 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
          <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">{status === 'in-progress' ? 'Started' : 'Renewal started'} {formatDate(progress.startedOn)}</span>
            {' '}({daysInProgress(progress) === 0 ? 'today' : `${daysInProgress(progress)} ${daysInProgress(progress) === 1 ? 'day' : 'days'} ago`})
            {progress.followUpOn && <> · Follow up by {formatDate(progress.followUpOn)}{followUpOverdue(progress) && <span className="font-medium text-red-800"> (overdue)</span>}</>}
            {progress.note && <><br />{progress.note}</>}
            <br /><span className="text-violet-900/80">Not counted as complete until the document is uploaded and approved.</span>
          </span>
        </p>
      )}

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
        <p className="mt-2 whitespace-pre-line leading-relaxed text-foreground">{req.help}</p>
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
          <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground">{reason.why}</p>
          {reason.source && (
            <p className="mt-2 leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Where it comes from:</span> <span className="whitespace-pre-line">{reason.source}</span>
            </p>
          )}
          {reason.sources.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {reason.sources.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand underline underline-offset-4"
                  >
                    {link.label || 'Read the source'}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </li>
  )
}
