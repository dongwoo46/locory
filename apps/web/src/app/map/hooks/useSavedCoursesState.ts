'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type MapMode = 'normal' | 'course-build' | 'course-view' | 'recommend-build';

interface UseSavedCoursesStateParams {
  userId: string;
  mapMode: MapMode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}

export function useSavedCoursesState({
  userId,
  mapMode,
  supabase,
}: UseSavedCoursesStateParams) {
  const [showSavedCourses, setShowSavedCourses] = useState(false);
  const [savedCoursesOverride, setSavedCoursesOverride] = useState<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any[] | null
  >(null);
  const [viewingCourseDay, setViewingCourseDay] = useState(1);
  const [selectedCoursePlace, setSelectedCoursePlace] = useState<string | null>(
    null,
  );

  const shouldLoadSavedCourses =
    showSavedCourses || mapMode === 'course-build' || mapMode === 'course-view';

  const { data: savedCoursesQuery = [] } = useQuery({
    queryKey: ['saved-courses', userId],
    enabled: shouldLoadSavedCourses,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_courses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const savedCourses = savedCoursesOverride ?? savedCoursesQuery;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setSavedCourses = (next: any[]) => setSavedCoursesOverride(next);

  return {
    showSavedCourses,
    setShowSavedCourses,
    savedCourses,
    setSavedCourses,
    viewingCourseDay,
    setViewingCourseDay,
    selectedCoursePlace,
    setSelectedCoursePlace,
  };
}
