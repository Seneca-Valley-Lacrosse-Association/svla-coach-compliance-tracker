'use client'

import Link from '@/components/app-link'
import { ClipboardList } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { useSurveyPreview, useSurveys } from '@/lib/use-surveys'
import { longDate, todayET } from '@/lib/surveys'

/** A banner on the coach's checklist when a coaching survey is waiting for them. */
export function SurveyPrompt() {
  const { preview } = useApp()
  const own = useSurveys()
  const previewed = useSurveyPreview(preview ? preview.email : null)
  const data = preview ? previewed.data : own.data
  const waiting = (data?.mine ?? []).find((s) => !s.submittedAt)
  if (!waiting) return null
  const overdue = todayET() > waiting.dueOn
  return (
    <Link href="/survey" className="flex items-center gap-4 rounded-xl border-2 border-brand bg-sky-50 p-4 text-navy hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-brand">
      <ClipboardList className="size-7 shrink-0 text-brand" aria-hidden="true" />
      <span className="flex-1">
        <span className="block font-semibold">{waiting.title}</span>
        <span className="block text-sm">{overdue ? `Was due ${longDate(waiting.dueOn)}. Your response is still welcome.` : `Please respond by ${longDate(waiting.dueOn)}. It takes about 10 minutes.`}</span>
      </span>
      <span className="shrink-0 font-semibold underline underline-offset-4">Take the survey</span>
    </Link>
  )
}
