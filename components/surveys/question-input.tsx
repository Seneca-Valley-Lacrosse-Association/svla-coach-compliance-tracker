'use client'

import { cn } from '@/lib/utils'
import type { Answer, SurveyQuestion } from '@/lib/surveys'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/** One survey question, rendered for its type. Used by the coach form and the board's question preview. */
export function QuestionInput({ id, question, label, value, error, disabled, onChange }: {
  id: string
  question: SurveyQuestion
  label: string
  value: Answer | undefined
  error?: string
  disabled?: boolean
  onChange: (value: Answer | undefined) => void
}) {
  const describedBy = [question.help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const heading = (
    <>
      {label}
      {question.required ? <span className="text-destructive" aria-hidden="true"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
      {question.required && <span className="sr-only"> (required)</span>}
    </>
  )
  const help = question.help ? <p id={`${id}-help`} className="text-sm text-muted-foreground">{question.help}</p> : null
  const errorText = error ? <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null

  if (question.kind === 'yes_no' || question.kind === 'single_choice' || question.kind === 'multi_choice') {
    const options = question.kind === 'yes_no' ? ['Yes', 'No'] : question.options
    const multi = question.kind === 'multi_choice'
    const selected = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
    return (
      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy} aria-invalid={!!error || undefined}>
        <legend className="mb-1 font-medium leading-snug">{heading}</legend>
        {help}
        <div className={cn('flex gap-2', question.kind === 'yes_no' ? 'flex-row flex-wrap' : 'flex-col')}>
          {options.map((option) => {
            const checked = selected.includes(option)
            return (
              <label key={option} className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand', checked && 'border-brand bg-sky-50', disabled && 'cursor-default opacity-70', question.kind === 'yes_no' && 'min-w-28')}>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={id}
                  value={option}
                  checked={checked}
                  disabled={disabled}
                  className="size-4 accent-brand"
                  onChange={(event) => {
                    if (!multi) return onChange(option)
                    const next = event.target.checked ? [...selected, option] : selected.filter((v) => v !== option)
                    onChange(next.length ? question.options.filter((o) => next.includes(o)) : undefined)
                  }}
                />
                <span>{option}</span>
              </label>
            )
          })}
        </div>
        {errorText}
      </fieldset>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium leading-snug">{heading}</label>
      {help}
      {question.kind === 'long_text' ? (
        <Textarea id={id} value={typeof value === 'string' ? value : ''} disabled={disabled} rows={4} maxLength={5000} aria-invalid={!!error} aria-describedby={describedBy} className="min-h-28 text-base" onChange={(event) => onChange(event.target.value)} />
      ) : question.kind === 'number' ? (
        <Input id={id} type="number" inputMode="decimal" min={0} max={100} step="any" value={value === undefined ? '' : String(value)} disabled={disabled} aria-invalid={!!error} aria-describedby={describedBy} className="h-10 max-w-32 text-base" onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)} />
      ) : (
        <Input id={id} value={typeof value === 'string' ? value : ''} disabled={disabled} maxLength={300} aria-invalid={!!error} aria-describedby={describedBy} className="h-10 text-base" onChange={(event) => onChange(event.target.value)} />
      )}
      {errorText}
    </div>
  )
}
