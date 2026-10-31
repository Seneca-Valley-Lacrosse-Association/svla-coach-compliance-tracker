'use client'

import { useId, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { surveyCommand } from '@/lib/use-surveys'
import { CHOICE_KINDS, QUESTION_KINDS, QUESTION_KIND_LABELS, fillLabel, type QuestionKind, type SurveyQuestion } from '@/lib/surveys'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { QuestionInput } from './question-input'

const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-brand'
const sample = { seasonLabel: '{season}', nextSeasonLabel: '{next_season}' }

/** The board's editable question bank. Each survey takes its own copy when it is sent, so edits only affect future surveys. */
export function QuestionBank({ questions, onChanged }: { questions: SurveyQuestion[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<SurveyQuestion | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  async function run(command: Record<string, unknown>) {
    setError('')
    try { await surveyCommand(command); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.') }
  }

  const active = questions.filter((q) => q.active !== false)
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-sky-50 p-4 text-sm leading-relaxed text-navy sm:flex-row sm:items-center">
        <p className="flex-1">These are the questions the <strong>next</strong> survey will use. When a survey is sent it keeps its own copy, so changes here never alter past surveys or their reports. Use {'{season}'} and {'{next_season}'} in a question to fill in the survey&apos;s season labels.</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="h-10 bg-card px-4" onClick={() => setPreview((p) => !p)}>{preview ? 'Back to editing' : 'Preview as a coach'}</Button>
          <Button className="h-10 px-4" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add question</Button>
        </div>
      </div>
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}

      {preview ? (
        <ol className="flex max-w-3xl flex-col gap-4">
          {active.map((q, i) => (
            <li key={q.key} className="rounded-xl border bg-card p-5 shadow-xs">
              <p className="mb-2 text-sm font-medium text-muted-foreground">Question {i + 1}{q.showIf ? ` · only shown when "${q.showIf.key}" is ${q.showIf.values.join(' or ')}` : ''}</p>
              <QuestionInput id={`preview-${q.key}`} question={q} label={fillLabel(q.label, sample)} value={undefined} onChange={() => {}} disabled />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {questions.map((q, i) => (
            <li key={q.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start ${q.active === false ? 'bg-muted/40' : ''}`}>
              <span className="w-8 shrink-0 pt-0.5 font-semibold text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium leading-snug ${q.active === false ? 'text-muted-foreground line-through' : ''}`}>{q.label}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{QUESTION_KIND_LABELS[q.kind]}</span>
                  <span>{q.required ? 'Required' : 'Optional'}</span>
                  {CHOICE_KINDS.includes(q.kind) && <span>{q.options.join(' · ')}</span>}
                  {q.showIf && <span>Shown when {q.showIf.key} is {q.showIf.values.join(' or ')}</span>}
                  {q.prefill === 'team' && <span>Prefilled from the tracker</span>}
                  {q.active === false && <span className="font-medium">Hidden from new surveys</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-lg" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => run({ action: 'moveQuestion', id: q.id, direction: 'up' })}><ArrowUp aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon-lg" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1} onClick={() => run({ action: 'moveQuestion', id: q.id, direction: 'down' })}><ArrowDown aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon-lg" aria-label={q.active === false ? `Show question ${i + 1} in new surveys` : `Hide question ${i + 1} from new surveys`} onClick={() => run({ action: 'updateQuestion', id: q.id, input: { ...q, active: q.active === false } })}>{q.active === false ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</Button>
                <Button variant="ghost" size="icon-lg" aria-label={`Edit question ${i + 1}`} onClick={() => setEditing(q)}><Pencil aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon-lg" aria-label={`Delete question ${i + 1}`} className="text-destructive" onClick={() => { if (window.confirm(`Delete "${q.label}"?\n\nPast surveys keep their answers to it. Hide it instead if you might want it back.`)) void run({ action: 'deleteQuestion', id: q.id }) }}><Trash2 aria-hidden="true" /></Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <QuestionDialog open={adding} onOpenChange={setAdding} questions={questions} onSaved={onChanged} />
      {editing && <QuestionDialog open onOpenChange={(o) => { if (!o) setEditing(null) }} question={editing} questions={questions} onSaved={onChanged} />}
    </section>
  )
}

type Draft = Omit<SurveyQuestion, 'id' | 'order'> & { optionsText: string; conditionKey: string; conditionValues: string[] }

function toDraft(q?: SurveyQuestion): Draft {
  return {
    key: q?.key ?? '', label: q?.label ?? '', help: q?.help ?? '', kind: q?.kind ?? 'long_text', options: q?.options ?? [],
    required: q?.required ?? false, showIf: q?.showIf ?? null, prefill: q?.prefill ?? null, active: q?.active ?? true,
    optionsText: (q?.options ?? []).join('\n'), conditionKey: q?.showIf?.key ?? '', conditionValues: q?.showIf?.values ?? [],
  }
}
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'q_$1').slice(0, 40) || 'question'

function QuestionDialog({ open, onOpenChange, question, questions, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; question?: SurveyQuestion; questions: SurveyQuestion[]; onSaved: () => void }) {
  const id = useId()
  const [draft, setDraft] = useState<Draft>(() => toDraft(question))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const choice = CHOICE_KINDS.includes(draft.kind)
  // A question can only depend on a choice-type question that comes before it.
  const index = question ? questions.findIndex((q) => q.id === question.id) : questions.length
  const parents = questions.slice(0, index).filter((q) => q.kind === 'yes_no' || CHOICE_KINDS.includes(q.kind))
  const parent = parents.find((q) => q.key === draft.conditionKey)
  const parentOptions = parent ? (parent.kind === 'yes_no' ? ['Yes', 'No'] : parent.options) : []

  function change(next: boolean) {
    if (next) setDraft(toDraft(question))
    setError('')
    onOpenChange(next)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    const options = choice ? draft.optionsText.split('\n').map((o) => o.trim()).filter(Boolean) : []
    if (!draft.label.trim()) return setError('Enter the question.')
    if (choice && options.length < 2) return setError('Add at least two options, one per line.')
    if (new Set(options).size !== options.length) return setError('Each option must be different.')
    if (draft.conditionKey && !draft.conditionValues.length) return setError('Choose which answer(s) show this question, or set it to always show.')
    const key = question?.key ?? (() => { let k = slug(draft.label); let n = 2; while (questions.some((q) => q.key === k)) k = `${slug(draft.label).slice(0, 36)}_${n++}`; return k })()
    const input = {
      key, label: draft.label.trim(), help: draft.help.trim(), kind: draft.kind, options, required: draft.required,
      showIf: draft.conditionKey ? { key: draft.conditionKey, values: draft.conditionValues } : null, prefill: draft.prefill, active: draft.active,
    }
    setBusy(true)
    try {
      await surveyCommand(question ? { action: 'updateQuestion', id: question.id, input } : { action: 'addQuestion', input })
      onSaved()
      onOpenChange(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{question ? 'Edit question' : 'Add a question'}</DialogTitle>
            <DialogDescription>Changes apply to the next survey that is sent. Surveys already sent keep their own wording.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-label`}>Question</FieldLabel>
              <Textarea id={`${id}-label`} rows={2} maxLength={500} value={draft.label} onChange={(e) => set('label', e.target.value)} />
              <FieldDescription>You can write {'{season}'} or {'{next_season}'} and the survey&apos;s labels are filled in.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-help`}>Help text (optional)</FieldLabel>
              <Input id={`${id}-help`} maxLength={1000} value={draft.help} onChange={(e) => set('help', e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-kind`}>Answer type</FieldLabel>
              <select id={`${id}-kind`} className={selectClass} value={draft.kind} onChange={(e) => set('kind', e.target.value as QuestionKind)}>
                {QUESTION_KINDS.map((k) => <option key={k} value={k}>{QUESTION_KIND_LABELS[k]}</option>)}
              </select>
            </Field>
            {choice && (
              <Field>
                <FieldLabel htmlFor={`${id}-options`}>Options, one per line</FieldLabel>
                <Textarea id={`${id}-options`} rows={5} value={draft.optionsText} onChange={(e) => set('optionsText', e.target.value)} />
                {question && <FieldDescription>Renaming an option does not change answers already given in past surveys.</FieldDescription>}
              </Field>
            )}
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 accent-brand" checked={draft.required} onChange={(e) => set('required', e.target.checked)} />
              <span>Required</span>
            </label>
            <Field>
              <FieldLabel htmlFor={`${id}-cond`}>When to show it</FieldLabel>
              <select id={`${id}-cond`} className={selectClass} value={draft.conditionKey} onChange={(e) => setDraft((d) => ({ ...d, conditionKey: e.target.value, conditionValues: [] }))}>
                <option value="">Always</option>
                {parents.map((q) => <option key={q.key} value={q.key}>Only after an answer to: {q.label.slice(0, 70)}{q.label.length > 70 ? '…' : ''}</option>)}
              </select>
            </Field>
            {parent && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Show it when the answer is</legend>
                {parentOptions.map((o) => (
                  <label key={o} className="flex items-center gap-3">
                    <input type="checkbox" className="size-4 accent-brand" checked={draft.conditionValues.includes(o)} onChange={(e) => set('conditionValues', e.target.checked ? [...draft.conditionValues, o] : draft.conditionValues.filter((v) => v !== o))} />
                    <span>{o}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {(draft.kind === 'short_text' || draft.kind === 'long_text') && (
              <label className="flex items-center gap-3">
                <input type="checkbox" className="size-4 accent-brand" checked={draft.prefill === 'team'} onChange={(e) => set('prefill', e.target.checked ? 'team' : null)} />
                <span>Fill in the coach&apos;s team from the tracker</span>
              </label>
            )}
          </FieldGroup>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => change(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : question ? 'Save question' : 'Add question'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
