'use client'

import { useId } from 'react'
import { coachPrograms } from '@/lib/compliance'
import { PROGRAM_LABELS, TEAM_PROGRAMS, type Coach } from '@/lib/types'
import { Field, FieldDescription } from '@/components/ui/field'

/** Shows which program(s) a team puts a coach in, with the "also coaches youth" option for high school teams. */
export function CoachProgramsField({ team, alsoCoachesYouth, onChange }: { team: Coach['team']; alsoCoachesYouth: boolean; onChange: (value: boolean) => void }) {
  const id = useId()
  const canAddYouth = !TEAM_PROGRAMS[team].includes('youth')
  const assigned = coachPrograms({ team, alsoCoachesYouth: canAddYouth && alsoCoachesYouth } as Coach).map((p) => PROGRAM_LABELS[p]).join(' and ')
  return (
    <Field>
      <p className="text-sm font-medium">Assigned to: <span className="font-semibold text-navy">{assigned}</span></p>
      {canAddYouth && (
        <label htmlFor={id} className="flex items-center gap-2 text-sm">
          <input id={id} type="checkbox" checked={alsoCoachesYouth} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand" />
          Also coaches youth
        </label>
      )}
      <FieldDescription>
        The program decides which requirements apply and which Cleared to Coach box is tracked on the dashboard. A coach is never shown as cleared for a program they are not assigned to.
      </FieldDescription>
    </Field>
  )
}
