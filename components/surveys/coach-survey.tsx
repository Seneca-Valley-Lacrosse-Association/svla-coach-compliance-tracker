'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { IT_EMAIL } from '@/lib/tickets'
import { useSurveys, surveyCommand, SurveyError, type MySurvey } from '@/lib/use-surveys'
import { fillLabel, initialAnswers, isVisible, longDate, teamLabel, todayET, type Answer, type Answers } from '@/lib/surveys'
import { Button } from '@/components/ui/button'
import { QuestionInput } from './question-input'

/** The signed-in coach's open coaching survey(s). */
export function CoachSurvey() {
  const { isDemo } = useApp()
  const { data, error, isLoading, mutate } = useSurveys()
  if (isDemo) return <Notice title="Coaching survey">The board demo does not include surveys.</Notice>
  if (isLoading) return <p role="status" className="mx-auto max-w-3xl">Loading your survey…</p>
  if (error) return <Notice title="Coaching survey">Your survey could not be loaded. Please refresh the page, or email <a className="font-medium text-primary underline" href={`mailto:${IT_EMAIL}`}>{IT_EMAIL}</a>.</Notice>
  const surveys = data?.mine ?? []
  if (!surveys.length) return <Notice title="No open survey">There is no coaching survey waiting for you right now. When the board sends one, you will get an email with a link to this page.</Notice>
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      {surveys.map((s) => <SurveyForm key={s.assignmentId} survey={s} onSaved={() => mutate()} />)}
    </div>
  )
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
      <h1 className="text-2xl font-semibold text-navy">{title}</h1>
      <p className="leading-relaxed text-muted-foreground">{children}</p>
    </section>
  )
}

function SurveyForm({ survey, onSaved }: { survey: MySurvey; onSaved: () => void }) {
  const { getSummary, currentCoachId, email } = useApp()
  const me = getSummary(currentCoachId)?.coach
  const questions = survey.questions
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(questions, survey.answers, survey.team))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'' | 'save' | 'submit'>('')
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [dirty, setDirty] = useState(false)
  const submitted = !!survey.submittedAt
  const [editing, setEditing] = useState(!submitted)
  const visible = useMemo(() => questions.filter((q) => isVisible(q, answers)), [questions, answers])
  const overdue = todayET() > survey.dueOn

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update(key: string, value: Answer | undefined) {
    setAnswers((prev) => {
      const next = { ...prev }
      if (value === undefined || value === '') delete next[key]
      else next[key] = value
      return next
    })
    setErrors((prev) => { const { [key]: _drop, ...rest } = prev; return rest })
    setDirty(true)
    setMessage('')
  }

  async function save(submit: boolean) {
    if (busy) return
    setBusy(submit ? 'submit' : 'save'); setFailure(''); setMessage('')
    try {
      await surveyCommand({ action: 'saveMine', assignmentId: survey.assignmentId, answers, submit })
      setDirty(false)
      setErrors({})
      if (submit) { setEditing(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
      else setMessage('Saved. You can come back and finish any time before the survey closes.')
      onSaved()
    } catch (error) {
      if (error instanceof SurveyError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors)
        const first = questions.find((q) => error.fieldErrors[q.key])
        if (first) document.getElementById(`q-${survey.assignmentId}-${first.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setFailure(error instanceof Error ? error.message : 'Could not save. Please try again.')
    } finally { setBusy('') }
  }

  if (submitted && !editing) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 size-7 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold text-navy">Thank you, {survey.coachName.split(' ')[0]}!</h1>
            <p className="mt-1 leading-relaxed text-muted-foreground">Your {survey.title} response was received. The board reads every answer.</p>
          </div>
        </div>
        <p className="leading-relaxed">You can change your answers until the survey closes{survey.closeOn ? ` on ${longDate(survey.closeOn)}` : ''}.</p>
        <div><Button variant="outline" className="h-10 px-4" onClick={() => setEditing(true)}>Review or edit my answers</Button></div>
      </section>
    )
  }

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); void save(true) }} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-1 size-6 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold text-navy text-balance lg:text-3xl">{survey.title}</h1>
            <p className={overdue ? 'mt-1 font-medium text-amber-800' : 'mt-1 text-muted-foreground'}>
              {overdue ? `This was due ${longDate(survey.dueOn)}. Your response is still welcome.` : `Please respond by ${longDate(survey.dueOn)}.`}
            </p>
          </div>
        </div>
        {survey.intro && <p className="whitespace-pre-wrap leading-relaxed">{survey.intro}</p>}
        <p className="text-sm text-muted-foreground">Questions marked <span className="text-destructive">*</span> are required. Use &ldquo;Save and finish later&rdquo; to keep a draft.</p>
      </section>

      <section aria-labelledby={`details-${survey.assignmentId}`} className="rounded-xl border bg-secondary/40 p-5">
        <h2 id={`details-${survey.assignmentId}`} className="font-semibold text-navy">Your details from the tracker</h2>
        <p className="mb-3 text-sm text-muted-foreground">{survey.profile.testDummy ? 'Test run: this address is not on the coach roster, so placeholder details (Jane Doe) are shown.' : <>These come from your profile and checklist, so you don&apos;t need to enter them.</>}</p>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Detail label="Name" value={survey.coachName} />
          <Detail label="Email" value={me?.email ?? email ?? '—'} />
          <Detail label="Team" value={teamLabel(survey.team) || '—'} />
          <Detail label="Role" value={survey.profile.role ?? me?.role ?? '—'} />
          <Detail label="USA Lacrosse certification" value={survey.profile.certification ? `${survey.profile.certification}${survey.profile.certificationVerified ? ' (verified)' : ''}` : '—'} />
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">Something wrong? Email <a className="font-medium text-primary underline" href={`mailto:${IT_EMAIL}`}>{IT_EMAIL}</a>.</p>
      </section>

      <ol className="flex flex-col gap-4">
        {visible.map((q, index) => (
          <li key={q.key} id={`q-${survey.assignmentId}-${q.key}`} className={`scroll-mt-24 rounded-xl border bg-card p-5 shadow-xs ${errors[q.key] ? 'border-destructive' : ''}`}>
            <p className="mb-2 text-sm font-medium text-muted-foreground">Question {index + 1} of {visible.length}</p>
            <QuestionInput
              id={`a-${survey.assignmentId}-${q.key}`}
              question={q}
              label={fillLabel(q.label, survey)}
              value={answers[q.key]}
              error={errors[q.key]}
              onChange={(value) => update(q.key, value)}
            />
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {failure && <p role="alert" className="font-medium text-destructive">{failure}</p>}
        {message && <p role="status" className="text-emerald-800">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11 px-6 text-base" disabled={!!busy}>{busy === 'submit' ? 'Submitting…' : submitted ? 'Save changes' : 'Submit survey'}</Button>
          {!submitted && <Button type="button" variant="outline" className="h-11 px-5 text-base" disabled={!!busy} onClick={() => void save(false)}>{busy === 'save' ? 'Saving…' : 'Save and finish later'}</Button>}
        </div>
      </div>
    </form>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}
