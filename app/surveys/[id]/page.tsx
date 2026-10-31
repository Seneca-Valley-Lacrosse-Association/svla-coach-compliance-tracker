import { SurveyDetail } from '@/components/surveys/survey-detail'

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SurveyDetail id={id} />
}
