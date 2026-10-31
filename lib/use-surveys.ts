'use client'

import useSWR from 'swr'
import { useApp } from '@/lib/app-store'
import type { Answers, SurveyAssignment, SurveyCycle, SurveyProfile, SurveyQuestion } from '@/lib/surveys'

export interface MySurvey {
  assignmentId: string
  cycleId: string
  title: string
  seasonLabel: string
  nextSeasonLabel: string
  intro: string
  dueOn: string
  closeOn: string | null
  questions: SurveyQuestion[]
  answers: Answers
  profile: SurveyProfile
  team: string
  coachName: string
  submittedAt: string | null
  updatedAt: string
}
export interface PastSurvey {
  assignmentId: string
  title: string
  seasonLabel: string
  nextSeasonLabel: string
  questions: SurveyQuestion[]
  answers: Answers
  team: string
  submittedAt: string
}
export interface SurveysSnapshot {
  role: 'board' | 'coach'
  mine: MySurvey[]
  past?: PastSurvey[]
  today?: string
  questions?: SurveyQuestion[]
  cycles?: SurveyCycle[]
  assignments?: SurveyAssignment[]
}

async function load(url: string): Promise<SurveysSnapshot> {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to load surveys.')
  return result
}

/** Open surveys for the signed-in person, plus everything for the board. Not used in the demo. */
export function useSurveys() {
  const { isDemo } = useApp()
  return useSWR<SurveysSnapshot>(isDemo ? null : '/api/surveys', load, { refreshInterval: 120000, shouldRetryOnError: false })
}

export class SurveyError extends Error {
  constructor(message: string, public fieldErrors: Record<string, string> = {}) { super(message) }
}

export async function surveyCommand<T = Record<string, unknown>>(command: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/surveys', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SVLA-Request': '1' }, body: JSON.stringify(command) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new SurveyError(result.error || 'Could not save. Please try again.', result.fieldErrors)
  return result as T
}
