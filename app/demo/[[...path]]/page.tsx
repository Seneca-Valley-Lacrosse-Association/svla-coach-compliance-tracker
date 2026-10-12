import { notFound } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { CoachesList } from '@/components/coaches/coaches-list'
import { CoachDetail } from '@/components/coach-detail/coach-detail'
import { RequirementsView } from '@/components/requirements/requirements-view'
import { ReviewQueue } from '@/components/review/review-queue'
import { ReportsView } from '@/components/reports/reports-view'

export default async function DemoPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params
  if (!path.length) return <DashboardView />
  if (path.length === 2 && path[0] === 'coaches') return <CoachDetail id={path[1]} />
  if (path.length !== 1) notFound()
  switch (path[0]) {
    case 'coaches': return <CoachesList />
    case 'requirements': return <RequirementsView />
    case 'review': return <ReviewQueue />
    case 'reports': return <ReportsView />
    default: notFound()
  }
}
