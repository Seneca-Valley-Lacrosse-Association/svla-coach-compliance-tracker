'use client'

import Link from '@/components/app-link'
import { AlertTriangle, FileText, Inbox } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { eligibilityIssue, formatDate } from '@/lib/compliance'
import { PageHeader } from '@/components/page-header'
import { ItemStatusPill, PayBadge } from '@/components/status-pill'
import { ReviewActions } from './review-actions'

export function ReviewQueue() {
  const { submissions, coaches, requirements } = useApp()
  const coachById = new Map(coaches.map((c) => [c.id, c]))
  const reqById = new Map(requirements.map((r) => [r.id, r]))

  const pending = submissions
    .filter((s) => s.status === 'pending')
    .sort((a, b) => a.uploadedOn.localeCompare(b.uploadedOn))

  const recent = submissions
    .filter((s) => s.status !== 'pending' && s.reviewedOn && s.reviewedOn >= '2026-10-01')
    .sort((a, b) => (b.reviewedOn ?? '').localeCompare(a.reviewedOn ?? ''))
    .slice(0, 5)

  return (
    <>
      <PageHeader
        title="Review Queue"
        description="Uploads waiting for a board member to approve or reject. Oldest first."
      />

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-center">
          <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">All caught up. Nothing is waiting for review.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((s) => {
            const coach = coachById.get(s.coachId)!
            const req = reqById.get(s.requirementId)!
            const issue = eligibilityIssue(coach, req, s)
            return (
              <li key={s.id} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">Uploaded {formatDate(s.uploadedOn)}</p>
                    <h2 className="text-lg font-semibold text-navy">{req.name}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/coaches/${coach.id}`} className="font-medium text-brand hover:underline">
                        {coach.name}
                      </Link>
                      <span className="text-muted-foreground">
                        {coach.team} · {coach.role}
                      </span>
                      <PayBadge pay={coach.pay} />
                    </div>
                  </div>
                  <ItemStatusPill status="pending" />
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd className="font-medium">{formatDate(s.completedOn)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Would expire</dt>
                    <dd className="font-medium">{s.expiresOn ? formatDate(s.expiresOn) : 'Never'}</dd>
                  </div>
                  {s.obtainedAs && (
                    <div>
                      <dt className="text-muted-foreground">Obtained as</dt>
                      <dd className="font-medium">{s.obtainedAs}</dd>
                    </div>
                  )}
                  {s.fbiMethod && (
                    <div>
                      <dt className="text-muted-foreground">Method</dt>
                      <dd className="font-medium">
                        {s.fbiMethod === 'affidavit' ? 'Volunteer affidavit' : 'Fingerprint'}
                      </dd>
                    </div>
                  )}
                  {s.membershipNumber && (
                    <div>
                      <dt className="text-muted-foreground">Member #</dt>
                      <dd className="font-medium">{s.membershipNumber}</dd>
                    </div>
                  )}
                  {s.signedName && (
                    <div>
                      <dt className="text-muted-foreground">Signed name</dt>
                      <dd className="font-medium">{s.signedName}</dd>
                    </div>
                  )}
                </dl>

                {s.fileName && (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/50 p-3 text-sm">
                    <FileText className="size-5 text-brand" aria-hidden="true" />
                    <span className="truncate">{s.fileName}</span>
                    <span className="ml-auto hidden text-muted-foreground sm:inline">
                      {s.filePath ? <span className="flex gap-3"><a href={`/api/documents/${s.id}?preview=1`} target="_blank" rel="noreferrer" className="text-primary underline">Preview</a><a href={`/api/documents/${s.id}`} target="_blank" rel="noreferrer" className="text-primary underline">Download document</a></span> : 'Demo record only'}
                    </span>
                  </div>
                )}

                {issue && (
                  <p className="flex gap-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {issue} Approving will record it, but it will not count toward clearance.
                  </p>
                )}

                <ReviewActions
                  submissionId={s.id}
                  coachName={coach.name}
                  requirementName={req.name}
                  warning={issue}
                />
              </li>
            )
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="mt-10 flex flex-col gap-3">
          <h2 id="recent-heading" className="text-lg font-semibold text-navy">
            Recently reviewed
          </h2>
          <ul className="divide-y rounded-xl border bg-card shadow-xs">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-medium">{coachById.get(s.coachId)?.name}</span>
                <span className="text-muted-foreground">{reqById.get(s.requirementId)?.name}</span>
                <span className="ml-auto flex items-center gap-2">
                  <ItemStatusPill status={s.status === 'approved' ? 'approved' : 'rejected'} />
                  <span className="text-sm text-muted-foreground">{formatDate(s.reviewedOn)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
