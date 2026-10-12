import { cn } from '@/lib/utils'
import type { ComplianceStatus, ItemStatus } from '@/lib/types'

const base =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset'

const tones = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-300',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-brand ring-sky-200',
  orange: 'bg-orange-50 text-orange-900 ring-orange-200',
}

const dotTones = {
  green: 'bg-emerald-600',
  gray: 'bg-slate-500',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
  blue: 'bg-brand',
  orange: 'bg-orange-600',
}

const complianceMap: Record<ComplianceStatus, { label: string; tone: keyof typeof tones }> = {
  cleared: { label: 'Cleared', tone: 'green' },
  incomplete: { label: 'Incomplete', tone: 'gray' },
  expiring: { label: 'Expiring', tone: 'amber' },
  expired: { label: 'Expired', tone: 'red' },
}

export const itemStatusMap: Record<ItemStatus, { label: string; tone: keyof typeof tones }> = {
  'not-started': { label: 'Not started', tone: 'gray' },
  pending: { label: 'Pending review', tone: 'blue' },
  approved: { label: 'Approved', tone: 'green' },
  expiring: { label: 'Expiring', tone: 'amber' },
  expired: { label: 'Expired', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'red' },
  invalid: { label: 'Not valid for role', tone: 'orange' },
}

function Pill({ label, tone, className }: { label: string; tone: keyof typeof tones; className?: string }) {
  return (
    <span className={cn(base, tones[tone], className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dotTones[tone])} />
      {label}
    </span>
  )
}

export function ComplianceStatusPill({ status, className }: { status: ComplianceStatus; className?: string }) {
  const { label, tone } = complianceMap[status]
  return <Pill label={label} tone={tone} className={className} />
}

export function ItemStatusPill({ status, className }: { status: ItemStatus; className?: string }) {
  const { label, tone } = itemStatusMap[status]
  return <Pill label={label} tone={tone} className={className} />
}

export function PayBadge({ pay }: { pay: 'Paid' | 'Volunteer' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium',
        pay === 'Paid' ? 'bg-navy text-white' : 'bg-secondary text-secondary-foreground',
      )}
    >
      {pay}
    </span>
  )
}
