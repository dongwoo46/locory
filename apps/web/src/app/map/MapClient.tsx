'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
} from '@vis.gl/react-google-maps';
import { useTranslations, useLocale } from 'next-intl';
import BottomNav from '@/components/ui/BottomNav';
import { CITIES, getMainDistricts } from '@/lib/utils/districts';
import type { City } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import { getPostImageUrl } from '@/lib/utils/postImage';
import {
  CATEGORY_COLOR,
  CATEGORY_EMOJIS,
} from './map.constants';
import type {
  Place,
  CourseData,
  CourseDay,
  CourseDayPlace,
  CourseSettings,
  SearchPlaceOption,
  PlacePost,
  MapQueryPost,
  MapQueryPlace,
  MapProfileLite,
  SavedCourseRecord,
} from './map.types';
import {
  PinMarker,
  CityNavigator,
  PlacePanner,
  RoutePolyline,
} from './map-overlays';
import MapTopControls from './components/MapTopControls';
import MapFilterModal from './components/MapFilterModal';
import PlaceFeedSheet from './components/PlaceFeedSheet';
import CourseBuildModals from './components/CourseBuildModals';
import RecommendBuildSheet from './components/RecommendBuildSheet';
import { useMapFilters } from './hooks/useMapFilters';
import { usePlacePostsSheet } from './hooks/usePlacePostsSheet';
import { useSavedCoursesState } from './hooks/useSavedCoursesState';
import { usePolylineTooltip } from './hooks/usePolylineTooltip';
import { useRecommendBuildState } from './hooks/useRecommendBuildState';
import 'react-day-picker/style.css';

interface Props {
  userId: string;
}

type MapPlaceAggregate = Place & {
  hasVisited: boolean;
  hasWant: boolean;
  _nationalitySet: Set<string>;
  _genderSet: Set<string>;
  _ratingCounts: Record<string, number>;
};

type WantPlaceRow = {
  places: MapQueryPlace | MapQueryPlace[] | null;
};

function asSinglePlace(
  place: MapQueryPlace | MapQueryPlace[] | null | undefined,
): MapQueryPlace | null {
  if (!place) return null;
  return Array.isArray(place) ? (place[0] ?? null) : place;
}

function asSingleProfile(
  profile: MapProfileLite | MapProfileLite[] | null | undefined,
): MapProfileLite | null {
  if (!profile) return null;
  return Array.isArray(profile) ? (profile[0] ?? null) : profile;
}

export default function MapClient({ userId }: Props) {
  const supabase = createClient();
  const locale = useLocale();
  const t = useTranslations('map');
  const tPost = useTranslations('post');

  // Map data cache
  const MAP_POST_FETCH_LIMIT = 300;
  const { data: mapData } = useQuery({
    queryKey: ['map-data', userId],
    queryFn: async () => {
      const { data: posts } = await supabase
        .from('posts')
        .select(
          'place_id, photos, photo_variants, type, rating, profiles!user_id(nationality, gender), places!place_id(id, name, lat, lng, category, city, district, place_type, avg_rating)',
        )
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(MAP_POST_FETCH_LIMIT);

      const placeMap = new Map<string, MapPlaceAggregate>();
      for (const post of (posts ?? []) as unknown as MapQueryPost[]) {
        const place = asSinglePlace(post.places);
        if (!place) continue;
        if (!placeMap.has(place.id)) {
          placeMap.set(place.id, {
            ...place,
            postCount: 0,
            photoUrl: null,
            rating: null,
            avg_rating: place.avg_rating ?? null,
            hasVisited: false,
            hasWant: false,
            _nationalitySet: new Set<string>(),
            _genderSet: new Set<string>(),
            _ratingCounts: {} as Record<string, number>,
          });
        }
        const entry = placeMap.get(place.id)!;
        entry.postCount++;
        if (!entry.photoUrl && ((post.photos?.length ?? 0) > 0 || post.photo_variants)) {
          entry.photoUrl = getPostImageUrl(post, 0, 'thumbnail');
        }
        const profile = asSingleProfile(post.profiles);
        const nationality = profile?.nationality;
        if (nationality) entry._nationalitySet.add(nationality);
        const gender = profile?.gender;
        if (gender) entry._genderSet.add(gender);
        if (post.type === 'visited') {
          entry.hasVisited = true;
          const r = post.rating;
          if (r) entry._ratingCounts[r] = (entry._ratingCounts[r] || 0) + 1;
        } else if (post.type === 'want') {
          entry.hasWant = true;
        }
      }

      const allPlaces = Array.from(placeMap.values()).map(
        ({ _nationalitySet, _genderSet, _ratingCounts, ...rest }) => ({
          ...rest,
          nationalities: Array.from(_nationalitySet),
          genders: Array.from(_genderSet),
          rating:
            (Object.entries(_ratingCounts) as [string, number][]).sort(
              (a, b) => b[1] - a[1],
            )[0]?.[0] ?? null,
        }),
      );

      return {
        allPlaces,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const allPlaces = useMemo<Place[]>(
    () => mapData?.allPlaces ?? [],
    [mapData?.allPlaces],
  );
  const { data: interactions } = useUserInteractions(userId);
  const savedPlaceIds = useMemo<Set<string>>(
    () => interactions?.savedPlaceIds ?? new Set(),
    [interactions?.savedPlaceIds],
  );

  // Base filters/state
  const {
    mode,
    setMode,
    city,
    categories,
    nationalities,
    genderFilter,
    setGenderFilter,
    hiddenOnly,
    setHiddenOnly,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    district,
    setDistrict,
    minRating,
    setMinRating,
    showFilters,
    setShowFilters,
    toggleCategory,
    selectCity,
    toggleNationality,
    resetFilters,
    hasActiveFilters,
  } = useMapFilters();
  const [selected, setSelected] = useState<Place | null>(null);
  const [highlighted, setHighlighted] = useState<Place | null>(null);

  // Place search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Course builder state
  const [mapMode, setMapMode] = useState<
    'normal' | 'course-build' | 'course-view' | 'recommend-build'
  >('normal');
  const [buildStep, setBuildStep] = useState<
    'select' | 'settings' | 'generating' | 'result'
  >('select');
  const [courseSelection, setCourseSelection] = useState<Place[]>([]);
  const [courseSettings, setCourseSettings] = useState<CourseSettings>({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    transport: 'transit',
    vibe: 'relaxed',
    companion: 'friends',
    timeRange: [8, 32] as [number, number], // 10:00 ~ 22:00
    startLocation: '',
    endLocation: '',
    extraConditions: '',
    ragEnabled: false,
    ragMaxPlaces: 0,
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [savedAccommodation, setSavedAccommodation] = useState<{
    name: string;
    address: string;
  } | null>(null);
  const [accomQuery, setAccomQuery] = useState('');
  const [accomResults, setAccomResults] = useState<SearchPlaceOption[]>([]);
  const [accomSearching, setAccomSearching] = useState(false);
  const [startLocQuery, setStartLocQuery] = useState('');
  const [startLocResults, setStartLocResults] = useState<SearchPlaceOption[]>(
    [],
  );
  const [startLocSearching, setStartLocSearching] = useState(false);
  const [endLocQuery, setEndLocQuery] = useState('');
  const [endLocResults, setEndLocResults] = useState<SearchPlaceOption[]>([]);
  const [endLocSearching, setEndLocSearching] = useState(false);

  // Feature 2: Place recommendation
  const [courseSource, setCourseSource] = useState<
    'user_selected' | 'ai_recommended'
  >('user_selected');
  const {
    showCourseTypePicker,
    setShowCourseTypePicker,
    recommendStep,
    setRecommendStep,
    recommendDistricts,
    setRecommendDistricts,
    recommendCities,
    recommendCityTab,
    setRecommendCityTab,
    recommendPlaceCount,
    setRecommendPlaceCount,
    showFewPlacesWarning,
    setShowFewPlacesWarning,
    showRecommendCalendar,
    setShowRecommendCalendar,
    recommendSettings,
    setRecommendSettings,
    resetRecommendSelection,
  } = useRecommendBuildState();

  const { polylineTooltip, showPolylineTooltip } = usePolylineTooltip();
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const {
    showSavedCourses,
    setShowSavedCourses,
    savedCourses,
    setSavedCourses,
    viewingCourseDay,
    setViewingCourseDay,
    selectedCoursePlace,
    setSelectedCoursePlace,
  } = useSavedCoursesState({
    userId,
    mapMode,
    supabase,
  });
  const savedCoursesTyped = savedCourses as SavedCourseRecord[];
  // for the want list selection panel
  const [showWantPicker, setShowWantPicker] = useState(false);
  const [wantPlaces, setWantPlaces] = useState<Place[]>([]);

  // Place feed sheet
  const fetchPostsByPlace = useCallback(
    async (
      placeId: string,
      offset: number,
      limit: number,
    ): Promise<PlacePost[]> => {
      const { data } = await supabase
        .from('posts')
        .select(
          'id, photos, photo_variants, type, rating, memo, recommended_menu, created_at, profiles!user_id(id, nickname, nationality), post_likes(count), post_saves(count)',
        )
        .eq('place_id', placeId)
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      return (data as PlacePost[]) || [];
    },
    [supabase],
  );
  const {
    placePostsLoading,
    isFetchingNextPage,
    hasNextPage,
    loadMorePosts,
    sortedPlacePosts,
    sheetSort,
    setSheetSort,
  } = usePlacePostsSheet({
    selectedPlaceId: selected?.id ?? null,
    fetchPostsByPlace,
  });

  const shouldLoadAccommodation =
    (mapMode === 'course-build' && buildStep === 'settings') ||
    (mapMode === 'recommend-build' && recommendStep === 'settings');
  useQuery({
    queryKey: ['saved-accommodation', userId],
    enabled: shouldLoadAccommodation,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('accommodation_name, accommodation_address')
        .eq('id', userId)
        .single();
      if (error) throw error;
      if (data?.accommodation_name) {
        setSavedAccommodation({
          name: data.accommodation_name,
          address: data.accommodation_address || '',
        });
      } else {
        setSavedAccommodation(null);
      }
      return data;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  async function searchAccomPlaces(q: string) {
    if (!q.trim()) {
      setAccomResults([]);
      return;
    }
    setAccomSearching(true);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setAccomResults(data.places || []);
    } finally {
      setAccomSearching(false);
    }
  }

  async function searchLocation(
    q: string,
    setResults: (r: SearchPlaceOption[]) => void,
    setSearching: (v: boolean) => void,
  ) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults((data.places as SearchPlaceOption[]) || []);
    } finally {
      setSearching(false);
    }
  }

  async function saveAccommodation(name: string, address: string) {
    await supabase
      .from('profiles')
      .update({ accommodation_name: name, accommodation_address: address })
      .eq('id', userId);
    setSavedAccommodation({ name, address });
    setAccomQuery('');
    setAccomResults([]);
  }

  const cityScroll = useDragScroll();
  const allCategories = useMemo(
    () => [...new Set(allPlaces.map((p) => p.category))],
    [allPlaces],
  );

  const places = useMemo(() => {
    return allPlaces
      .filter((p) => mode === 'all' || savedPlaceIds.has(p.id))
      .filter((p) => !city || p.city === city)
      .filter((p) => categories.size === 0 || categories.has(p.category))
      .filter((p) => !hiddenOnly || p.place_type === 'hidden_spot')
      .filter((p) => {
        if (viewMode === 'feed') return p.hasVisited === true;
        if (viewMode === 'places') return p.hasWant === true;
        return true;
      })
      .filter((p) => {
        if (minRating == null) return true;
        return p.avg_rating != null && p.avg_rating >= minRating;
      })
      .filter((p) => {
        if (nationalities.size === 0) return true;
        if (!p.nationalities || p.nationalities.length === 0) return false;
        return p.nationalities.some((n) => nationalities.has(n));
      })
      .filter((p) => {
        if (!genderFilter) return true;
        if (!p.genders || p.genders.length === 0) return false;
        return p.genders.includes(genderFilter);
      })
      .filter((p) => !district || p.district === district)
      .sort((a, b) => (sortBy === 'popular' ? b.postCount - a.postCount : 0));
  }, [
    allPlaces,
    mode,
    savedPlaceIds,
    city,
    categories,
    hiddenOnly,
    viewMode,
    minRating,
    nationalities,
    genderFilter,
    district,
    sortBy,
  ]);

  const districtList = useMemo(
    () => (city ? getMainDistricts(city as City) : []),
    [city],
  );

  const searchResults = useMemo(() => {
    if (searchQuery.trim().length === 0) return [];
    const lower = searchQuery.trim().toLowerCase();
    return allPlaces
      .filter((p) => p.name.toLowerCase().includes(lower))
      .slice(0, 5);
  }, [searchQuery, allPlaces]);
  function handleSearchSelect(place: Place) {
    setHighlighted(place);
    setSearchQuery('');
    setShowSearchDropdown(false);
    if (place.city) {
      selectCity(place.city);
    }
  }

  function exitCourseMode() {
    setMapMode('normal');
    setBuildStep('select');
    setCourseSelection([]);
    setCourseData(null);
    setCourseTitle('');
    setViewingCourseDay(1);
    setSelectedCoursePlace(null);
  }

  const loadWantPlaces = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select(
        'place_id, places!place_id(id, name, lat, lng, category, city, district, place_type, avg_rating)',
      )
      .eq('user_id', userId)
      .eq('type', 'want')
      .is('deleted_at', null);
    const places = ((data ?? []) as unknown as WantPlaceRow[])
      .map((row) => asSinglePlace(row.places))
      .filter((place): place is MapQueryPlace => Boolean(place))
      .filter(
        (place, index, arr) =>
          arr.findIndex((candidate) => candidate?.id === place?.id) === index,
      )
      .map(
        (place): Place => ({
          ...place,
          postCount: 0,
          photoUrl: null,
          rating: null,
        }),
      );
    setWantPlaces(places);
  }, [supabase, userId]);

  useEffect(() => {
    if (!showWantPicker || wantPlaces.length > 0) return;
    void loadWantPlaces();
  }, [showWantPicker, wantPlaces.length, loadWantPlaces]);

  function toggleCoursePlace(place: Place) {
    setCourseSelection((prev) => {
      const exists = prev.find((p) => p.id === place.id);
      if (exists) return prev.filter((p) => p.id !== place.id);
      return [...prev, place];
    });
  }

  async function handleGenerateCourse() {
    if (courseSelection.length < 1) return;
    setCourseSource('user_selected');
    setCourseLoading(true);
    setBuildStep('generating');
    try {
      const res = await fetch('/api/course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          places: courseSelection.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            district: p.district,
            city: p.city,
            lat: p.lat,
            lng: p.lng,
            avg_rating: p.avg_rating,
            recommended_menu: null,
            postCount: p.postCount,
          })),
          startDate: courseSettings.startDate,
          endDate: courseSettings.endDate,
          transport: courseSettings.transport,
          vibe: courseSettings.vibe,
          companion: courseSettings.companion,
          timeRange: courseSettings.timeRange,
          startLocation: courseSettings.startLocation,
          endLocation: courseSettings.endLocation,
          extraConditions: courseSettings.extraConditions,
          ragEnabled: courseSettings.ragEnabled,
          ragMaxPlaces: courseSettings.ragMaxPlaces,
          userId,
        }),
      });
      const data: CourseData & { error?: string } = await res.json();
      if (data.error) throw new Error(data.error);
      setCourseData(data);
      setBuildStep('result');
      setMapMode('course-view');
      setViewingCourseDay(1);
    } catch {
      alert(t('course.courseGenFailed'));
      setBuildStep('settings');
    } finally {
      setCourseLoading(false);
    }
  }

  async function handleSaveCourse() {
    if (!courseData || !courseTitle.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('saved_courses')
        .insert({
          user_id: userId,
          title: courseTitle,
          place_ids: courseSelection.map((p) => p.id),
          days: Math.max(
            1,
            Math.round(
              (new Date(courseSettings.endDate).getTime() -
                new Date(courseSettings.startDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1,
          ),
          transport: courseSettings.transport,
          vibe: courseSettings.vibe,
          companion: courseSettings.companion,
          origin_name:
            courseSettings.startLocation ||
            savedAccommodation?.name ||
            t('course.unspecified'),
          city: courseSelection[0]?.city || null,
          course_data: courseData,
          is_public: true,
          source: courseSource,
        })
        .select()
        .single();
      if (error) throw error;
      setSavedCourses([data as SavedCourseRecord, ...savedCoursesTyped]);
      alert(t('course.courseSaved'));
    } catch {
      alert(t('course.courseSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRecommendCourse() {
    if (recommendDistricts.length === 0 && recommendCities.length === 0) return;
    setCourseSource('ai_recommended');
    setCourseLoading(true);
    setRecommendStep('generating');
    try {
      const res = await fetch('/api/course/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districts: recommendDistricts,
          cities: recommendCities,
          startDate: recommendSettings.startDate,
          endDate: recommendSettings.endDate,
          timeRange: recommendSettings.timeRange,
          styles: recommendSettings.styles,
          companion: recommendSettings.companion,
          extraConditions: recommendSettings.extraConditions,
          userId,
        }),
      });
      const data: CourseData & { error?: string } = await res.json();
      if (data.error) throw new Error(data.error);
      setCourseData(data);
      setRecommendStep('result');
      setMapMode('course-view');
      setViewingCourseDay(1);
      // Apply recommended places to course selection
      if (data.days) {
        const allPlaceIds = data.days.flatMap((day: CourseDay) =>
          day.places.map((place: CourseDayPlace) => place.place_id),
        );
        const { data: placesData } = await supabase
          .from('places')
          .select(
            'id, name, category, district, city, lat, lng, avg_rating, place_type',
          )
          .in('id', allPlaceIds);
        if (placesData) setCourseSelection(placesData as Place[]);
      }
    } catch {
      alert(t('course.courseGenFailed'));
      setRecommendStep('settings');
    } finally {
      setCourseLoading(false);
    }
  }

  async function checkRecommendPlaceCount() {
    let query = supabase
      .from('places')
      .select('id', { count: 'exact', head: true });
    if (recommendDistricts.length > 0) {
      query = query.in('district', recommendDistricts);
    } else if (recommendCities.length > 0) {
      query = query.in('city', recommendCities);
    } else return;
    const { count } = await query;
    setRecommendPlaceCount(count ?? 0);
    if ((count ?? 0) <= 5) {
      setShowFewPlacesWarning(true);
    } else {
      setRecommendStep('settings');
    }
  }

  async function handleLoadCourse(course: SavedCourseRecord) {
    const loadedCourseData = course.course_data;
    if (!loadedCourseData) return;
    const allPlaceIds = loadedCourseData.days.flatMap((day: CourseDay) =>
      day.places.map((place: CourseDayPlace) => place.place_id),
    );
    const selectedPlaces = allPlaceIds
      .map((id: string) => allPlaces.find((p) => p.id === id))
      .filter(Boolean) as Place[];
    setCourseSelection(selectedPlaces);
    setCourseData(loadedCourseData);
    setMapMode('course-view');
    setViewingCourseDay(1);
    setShowSavedCourses(false);
    setBuildStep('result');
  }

  // day colors
  const DAY_COLORS = [
    '#7C3AED',
    '#0891B2',
    '#059669',
    '#D97706',
    '#DC2626',
    '#BE185D',
    '#1D4ED8',
  ];

  // order map for numbered markers
  const courseOrderMap: Record<string, { order: number; day: number }> = {};
  if (courseData && mapMode === 'course-view') {
    courseData.days.forEach((d) => {
      d.places.forEach((p) => {
        courseOrderMap[p.place_id] = { order: p.order, day: d.day };
      });
    });
  } else if (mapMode === 'course-build') {
    courseSelection.forEach((p, i) => {
      courseOrderMap[p.id] = { order: i + 1, day: 1 };
    });
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <APIProvider
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
        language={locale}
      >
        <GoogleMap
          defaultCenter={{ lat: 36.5, lng: 127.8 }}
          defaultZoom={7}
          mapId="locory-map"
          gestureHandling="greedy"
          disableDefaultUI
          className="w-full h-full"
          onClick={() => {
            if (mapMode === 'normal') setSelected(null);
          }}
        >
          <CityNavigator city={city} />
          <PlacePanner place={highlighted ?? selected} />

          {/* Per-day polylines in course-view mode */}
          {mapMode === 'course-view' &&
            courseData &&
            courseData.days.map((day) => {
              const dayPlaces = day.places
                .sort((a, b) => a.order - b.order)
                .map(
                  (p) =>
                    allPlaces.find((pl) => pl.id === p.place_id) ??
                    courseSelection.find((pl) => pl.id === p.place_id),
                )
                .filter(Boolean) as Place[];
              if (dayPlaces.length < 2) return null;
              const color = DAY_COLORS[(day.day - 1) % DAY_COLORS.length];
              return (
                <RoutePolyline
                  key={day.day}
                  points={dayPlaces.map((p) => ({ lat: p.lat, lng: p.lng }))}
                  color={color}
                  onActivate={() =>
                    showPolylineTooltip(`${t('day')} ${day.day} · ${day.theme}`)
                  }
                />
              );
            })}

          {/* In course-view: show ONLY course places as numbered markers */}
          {mapMode === 'course-view' &&
            courseData &&
            courseData.days.flatMap((day) =>
              day.places
                .sort((a, b) => a.order - b.order)
                .map((p) => {
                  const place =
                    allPlaces.find((pl) => pl.id === p.place_id) ??
                    courseSelection.find((pl) => pl.id === p.place_id);
                  if (!place) return null;
                  const color = DAY_COLORS[(day.day - 1) % DAY_COLORS.length];
                  return (
                    <AdvancedMarker
                      key={`${day.day}-${p.place_id}`}
                      position={{ lat: place.lat, lng: place.lng }}
                      onClick={() =>
                        setSelectedCoursePlace(
                          selectedCoursePlace === p.place_id
                            ? null
                            : p.place_id,
                        )
                      }
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: '2.5px solid white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: 12,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          cursor: 'pointer',
                        }}
                      >
                        {p.order}
                      </div>
                    </AdvancedMarker>
                  );
                }),
            )}

          {/* In normal/build mode: show regular place pins */}
          {mapMode !== 'course-view' &&
            places.map((place) => {
              const buildOrder =
                mapMode === 'course-build'
                  ? courseSelection.findIndex((p) => p.id === place.id)
                  : -1;
              const isSelected = buildOrder >= 0;
              return (
                <AdvancedMarker
                  key={place.id}
                  position={{ lat: place.lat, lng: place.lng }}
                  onClick={() => {
                    if (mapMode === 'course-build') {
                      toggleCoursePlace(place);
                    } else {
                      setHighlighted(null);
                      setSelected(place);
                    }
                  }}
                >
                  <PinMarker
                    color={CATEGORY_COLOR[place.category] || '#607D8B'}
                    selected={
                      selected?.id === place.id ||
                      isSelected ||
                      highlighted?.id === place.id
                    }
                    order={isSelected ? buildOrder + 1 : undefined}
                    photoUrl={
                      mapMode === 'course-build' && isSelected
                        ? null
                        : place.photoUrl
                    }
                    name={place.name}
                    categoryLabel={tPost(`category.${place.category}`)}
                    rating={place.rating}
                    ratingLabel={
                      place.rating ? tPost(`rating.${place.rating}`) : undefined
                    }
                  />
                </AdvancedMarker>
              );
            })}
        </GoogleMap>
      </APIProvider>

      <MapTopControls
        mapMode={mapMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showSearchDropdown={showSearchDropdown}
        setShowSearchDropdown={setShowSearchDropdown}
        searchResults={searchResults}
        onSearchSelect={handleSearchSelect}
        categoryEmojis={CATEGORY_EMOJIS}
        hasActiveFilters={hasActiveFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        mode={mode}
        setMode={setMode}
        onOpenSavedCourses={() => setShowSavedCourses(true)}
        onOpenCourseTypePicker={() => {
          setShowCourseTypePicker(true);
          setSelected(null);
        }}
        cityScrollRef={cityScroll.ref}
        onCityMouseDown={cityScroll.onMouseDown}
        onCityMouseMove={cityScroll.onMouseMove}
        onCityMouseUp={cityScroll.onMouseUp}
        onCityMouseLeave={cityScroll.onMouseLeave}
        city={city}
        selectCity={selectCity}
        cities={CITIES}
        districtList={districtList}
        district={district}
        setDistrict={setDistrict}
      />

      {/* Course builder bottom sheet */}
      {mapMode === 'course-build' && (
        <div className="fixed bottom-[88px] left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="bg-white w-full max-w-lg px-4 py-3 flex items-center gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.15)] rounded-2xl border border-gray-100 pointer-events-auto">
            <button onClick={exitCourseMode} className="text-gray-400 shrink-0">
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">
                {t('course.buildTitle')}
              </p>
              <p className="text-xs text-gray-400">
                {courseSelection.length === 0
                  ? t('course.tapToSelect')
                  : t('course.selectedCount', {
                      count: courseSelection.length,
                    })}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {courseSelection.length >= 1 && (
                <button
                  onClick={() => setBuildStep('settings')}
                  className="px-4 py-1.5 bg-gray-900 text-white text-xs rounded-full font-medium"
                >
                  {t('course.settingsBtn')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {mapMode === 'course-view' && courseData && (
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="max-w-lg mx-auto px-3 pt-3">
            <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
              <button
                onClick={exitCourseMode}
                className="text-gray-400 shrink-0"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {courseData.title}
                </p>
                <p className="text-xs text-gray-400">
                  {t('course.dayPlaces', {
                    days: Math.max(
                      1,
                      Math.round(
                        (new Date(courseSettings.endDate).getTime() -
                          new Date(courseSettings.startDate).getTime()) /
                          (1000 * 60 * 60 * 24),
                      ) + 1,
                    ),
                    count: courseSelection.length,
                  })}
                </p>
              </div>
              <button
                onClick={() => {
                  const url =
                    window.location.origin +
                    '/course/' +
                    (savedCoursesTyped[0]?.id || '');
                  if (navigator.share) navigator.share({ url });
                  else
                    navigator.clipboard
                      .writeText(url)
                      .then(() => alert(t('linkCopied')));
                }}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full font-medium shrink-0"
              >
                {t('share')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place count badge */}
      {mapMode === 'normal' && places.length > 0 && !selected && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            {places.length}
            {t('placeCount')}
          </div>
        </div>
      )}

      <PlaceFeedSheet
        place={selected}
        open={Boolean(selected) && mapMode === 'normal'}
        onClose={() => setSelected(null)}
        placePostsLoading={placePostsLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={Boolean(hasNextPage)}
        onLoadMore={loadMorePosts}
        sortedPlacePosts={sortedPlacePosts}
        sheetSort={sheetSort}
        setSheetSort={setSheetSort}
      />

      {/* Empty state when no place found */}
      {places.length === 0 && mapMode === 'normal' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-white rounded-2xl shadow px-6 py-4 text-center">
            <p className="text-sm text-gray-400">{t('noPlaces')}</p>
          </div>
        </div>
      )}

      <CourseBuildModals
        mapMode={mapMode}
        buildStep={buildStep}
        setBuildStep={setBuildStep}
        courseSettings={courseSettings}
        setCourseSettings={setCourseSettings}
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        courseLoading={courseLoading}
        courseSelection={courseSelection}
        handleGenerateCourse={handleGenerateCourse}
        savedAccommodation={savedAccommodation}
        clearSavedAccommodation={() => {
          setSavedAccommodation(null);
          supabase
            .from('profiles')
            .update({
              accommodation_name: null,
              accommodation_address: null,
            })
            .eq('id', userId);
        }}
        accomQuery={accomQuery}
        setAccomQuery={setAccomQuery}
        accomResults={accomResults}
        setAccomResults={setAccomResults}
        accomSearching={accomSearching}
        searchAccomPlaces={searchAccomPlaces}
        saveAccommodation={saveAccommodation}
        startLocQuery={startLocQuery}
        setStartLocQuery={setStartLocQuery}
        startLocResults={startLocResults}
        setStartLocResults={setStartLocResults}
        startLocSearching={startLocSearching}
        setStartLocSearching={setStartLocSearching}
        endLocQuery={endLocQuery}
        setEndLocQuery={setEndLocQuery}
        endLocResults={endLocResults}
        setEndLocResults={setEndLocResults}
        endLocSearching={endLocSearching}
        setEndLocSearching={setEndLocSearching}
        searchLocation={searchLocation}
      />

      {/* Course result bottom sheet */}
      {mapMode === 'course-view' && courseData && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center mb-16">
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl shadow-xl"
            style={{ maxHeight: 'calc(50vh - 64px)' }}
          >
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Day ??*/}
            <div className="flex gap-0 border-b border-gray-100 shrink-0 px-4">
              {courseData.days.map((day) => (
                <button
                  key={day.day}
                  onClick={() => setViewingCourseDay(day.day)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                    viewingCourseDay === day.day
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-400'
                  }`}
                >
                  Day {day.day}
                </button>
              ))}
            </div>

            {/* Places for selected day */}
            <div
              className="overflow-y-auto flex-1 pb-20"
              style={{ maxHeight: 'calc(50vh - 100px)' }}
            >
              {(() => {
                const dayData = courseData.days.find(
                  (d) => d.day === viewingCourseDay,
                );
                if (!dayData) return null;
                const color =
                  DAY_COLORS[(viewingCourseDay - 1) % DAY_COLORS.length];
                return (
                  <>
                    <p className="text-[10px] text-gray-400 px-4 pt-2 pb-1">
                      {dayData.theme}
                    </p>
                    {dayData.places
                      .sort((a, b) => a.order - b.order)
                      .map((p) => {
                        const place =
                          allPlaces.find((pl) => pl.id === p.place_id) ??
                          courseSelection.find((pl) => pl.id === p.place_id);
                        if (!place) return null;
                        const isExpanded = selectedCoursePlace === p.place_id;
                        return (
                          <button
                            key={p.place_id}
                            onClick={() =>
                              setSelectedCoursePlace(
                                isExpanded ? null : p.place_id,
                              )
                            }
                            className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                                style={{ backgroundColor: color }}
                              >
                                {p.order}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {place.name}
                                  </p>
                                  <span className="text-xs text-gray-400 shrink-0">
                                    {p.estimated_arrival}
                                  </span>
                                </div>
                                {isExpanded && (
                                  <div className="mt-2 flex flex-col gap-1.5">
                                    <p className="text-xs text-gray-700 leading-relaxed">
                                      {p.activity}
                                    </p>
                                    {p.tip && (
                                      <div className="flex items-start gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5">
                                        <span className="text-amber-500 text-xs shrink-0">
                                          💡
                                        </span>
                                        <p className="text-xs text-amber-800">
                                          {p.tip}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <svg
                                className="shrink-0 mt-1 transition-transform"
                                style={{
                                  transform: isExpanded
                                    ? 'rotate(180deg)'
                                    : 'none',
                                }}
                                width="14"
                                height="14"
                                fill="none"
                                stroke="#9CA3AF"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path d="M6 9l6 6 6-6" strokeLinecap="round" />
                              </svg>
                            </div>
                          </button>
                        );
                      })}
                  </>
                );
              })()}

              {/* Common area */}
              {buildStep === 'result' && !saving && (
                <div className="px-4 py-3 flex flex-col gap-2">
                  <input
                    type="text"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder={t('course.titlePlaceholder')}
                    className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setBuildStep('settings');
                        setMapMode('course-build');
                        setCourseData(null);
                      }}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium"
                    >
                      {t('course.regenerateBtn')}
                    </button>
                    <button
                      onClick={handleSaveCourse}
                      disabled={saving || !courseTitle.trim()}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
                    >
                      {t('course.saveBtn')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm save list modal */}
      {showWantPicker && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-end justify-center"
          onClick={() => setShowWantPicker(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-4 pb-8 pt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900">
                  {t('course.wantListTitle')}
                </h2>
                <button
                  onClick={() => setShowWantPicker(false)}
                  className="text-xs text-gray-500"
                >
                  {t('course.done')}
                </button>
              </div>
              {wantPlaces.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  {t('course.noWantPlaces')}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {wantPlaces.map((place: Place) => {
                    const isSelected = courseSelection.some(
                      (p) => p.id === place.id,
                    );
                    return (
                      <button
                        key={place.id}
                        onClick={() => toggleCoursePlace(place)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white'}`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              CATEGORY_COLOR[place.category] || '#607D8B',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {place.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {tPost(`category.${place.category}`)}
                          </p>
                        </div>
                        {isSelected && (
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#111"
                            strokeWidth={2.5}
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M20 6L9 17l-5-5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved course list */}
      {showSavedCourses && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-end justify-center"
          onClick={() => setShowSavedCourses(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-4 pb-8 pt-2">
              <h2 className="text-base font-bold text-gray-900 mb-4">
                {t('course.savedCoursesTitle')}
              </h2>
              {savedCoursesTyped.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  {t('course.noSavedCourses')}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedCoursesTyped.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => handleLoadCourse(course)}
                      className="text-left px-4 py-3 bg-gray-50 rounded-2xl flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {course.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('course.dayPlaces', {
                            days: course.days,
                            count: (course.place_ids || []).length,
                          })}{' '}
                          {course.transport === 'transit'
                            ? t('course.transportTransitShort')
                            : course.transport === 'walking'
                              ? t('course.transportWalkingShort')
                              : t('course.transportDrivingShort')}
                        </p>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="#9CA3AF"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Route tooltip */}
      {polylineTooltip && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
          <div className="bg-gray-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            {polylineTooltip}
          </div>
        </div>
      )}

      {/* Route selection modal */}
      {showCourseTypePicker && (
        <div className="fixed inset-0 z-40 flex items-end pointer-events-auto">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCourseTypePicker(false)}
          />
          <div className="relative w-full bg-white rounded-t-2xl px-4 pt-5 pb-8 mb-16">
            <h2 className="text-base font-bold text-gray-900 mb-1">
              {t('recommend.pickTitle')}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('recommend.pickDesc')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowCourseTypePicker(false);
                  setMapMode('course-build');
                  setBuildStep('select');
                }}
                className="flex items-center gap-3 px-4 py-3.5 border-2 border-gray-200 rounded-xl text-left"
              >
                <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t('recommend.pickFeature1')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('recommend.pickFeature1Desc')}
                  </p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowCourseTypePicker(false);
                  setMapMode('recommend-build');
                  resetRecommendSelection();
                }}
                className="flex items-center gap-3 px-4 py-3.5 border-2 border-gray-200 rounded-xl text-left"
              >
                <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t('recommend.pickFeature2')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('recommend.pickFeature2Desc')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <RecommendBuildSheet
        open={mapMode === 'recommend-build'}
        recommendStep={recommendStep}
        setRecommendStep={setRecommendStep}
        recommendCityTab={recommendCityTab}
        setRecommendCityTab={setRecommendCityTab}
        recommendDistricts={recommendDistricts}
        setRecommendDistricts={setRecommendDistricts}
        showFewPlacesWarning={showFewPlacesWarning}
        setShowFewPlacesWarning={setShowFewPlacesWarning}
        recommendPlaceCount={recommendPlaceCount}
        checkRecommendPlaceCount={checkRecommendPlaceCount}
        showRecommendCalendar={showRecommendCalendar}
        setShowRecommendCalendar={setShowRecommendCalendar}
        recommendSettings={recommendSettings}
        setRecommendSettings={setRecommendSettings}
        handleRecommendCourse={handleRecommendCourse}
        onClose={() => setMapMode('normal')}
      />

      <MapFilterModal
        open={mapMode === 'normal' && showFilters}
        onClose={() => setShowFilters(false)}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        t={t}
        tPost={tPost}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        minRating={minRating}
        setMinRating={setMinRating}
        allCategories={allCategories}
        categories={categories}
        toggleCategory={toggleCategory}
        hiddenOnly={hiddenOnly}
        setHiddenOnly={setHiddenOnly}
        nationalities={nationalities}
        toggleNationality={toggleNationality}
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
      />

      <BottomNav />
    </div>
  );
}
