import { CoachDetail } from '@/components/coach-detail/coach-detail'

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CoachDetail id={id} />
}
