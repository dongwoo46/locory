import { createClient } from '@/lib/supabase/server'
import CourseShareClient from './CourseShareClient'

interface Props {
  params: { id: string }
}

export default async function CourseSharePage({ params }: Props) {
  const supabase = await createClient()
  const { id } = params

  const { data: course } = await supabase
    .from('saved_courses')
    .select('id, title, city, days, transport, style, companion, course_data, place_ids, created_at')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center px-6">
          <p className="text-2xl mb-2">🗺</p>
          <p className="text-base font-semibold text-gray-900">코스를 찾을 수 없어요</p>
          <p className="text-sm text-gray-400 mt-1">링크가 잘못되었거나 비공개 코스예요.</p>
        </div>
      </div>
    )
  }

  const placeIds: string[] = course.place_ids || []

  const { data: places } = placeIds.length > 0
    ? await supabase
        .from('places')
        .select('id, name, lat, lng, category, city, district')
        .in('id', placeIds)
    : { data: [] }

  return (
    <CourseShareClient
      course={course as any}
      places={places || []}
    />
  )
}
