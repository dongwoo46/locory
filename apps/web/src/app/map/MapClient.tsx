'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import { useTranslations, useLocale } from 'next-intl';
import BottomNav from '@/components/ui/BottomNav';
import ReportSheet from '@/components/ui/ReportSheet';
import { CITIES, getMainDistricts, getDistricts } from '@/lib/utils/districts';
import type { City } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useDragScroll } from '@/hooks/useDragScroll'
import { useUserInteractions } from '@/hooks/useUserInteractions';
import { Range, getTrackBackground } from 'react-range'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'

const CATEGORY_COLOR: Record<string, string> = {
  cafe: '#795548',
  restaurant: '#F44336',
  photospot: '#9C27B0',
  bar: '#FF9800',
  culture: '#2196F3',
  nature: '#4CAF50',
  shopping: '#E91E63',
  street: '#607D8B',
};

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷',
  JP: '🇯🇵',
  US: '🇺🇸',
  CN: '🇨🇳',
  TW: '🇹🇼',
  ES: '🇪🇸',
  RU: '🇷🇺',
  GB: '🇬🇧',
  FR: '🇫🇷',
  DE: '🇩🇪',
  IT: '🇮🇹',
  AU: '🇦🇺',
  OTHER: '🌍',
};

const RATING_COLORS: Record<string, string> = {
  must_go: '#B090D4',
  worth_it: '#6AC0D4',
  neutral: '#90C490',
  not_great: '#E8C070',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  cafe: '☕', restaurant: '🍽️', photospot: '📸', street: '🚶',
  bar: '🍻', culture: '🎨', nature: '🌿', shopping: '🛍️',
};

const NATIONALITY_CHIPS = [
  { code: 'KR', flag: '🇰🇷' },
  { code: 'JP', flag: '🇯🇵' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'CN', flag: '🇨🇳' },
  { code: 'TW', flag: '🇹🇼' },
  { code: 'GB', flag: '🇬🇧' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'IT', flag: '🇮🇹' },
  { code: 'ES', flag: '🇪🇸' },
  { code: 'AU', flag: '🇦🇺' },
  { code: 'RU', flag: '🇷🇺' },
  { code: 'OTHER', flag: '🌍' },
];

const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> =
  {
    seoul: { lat: 37.5665, lng: 126.978, zoom: 12 },
    busan: { lat: 35.1796, lng: 129.0756, zoom: 12 },
    jeju: { lat: 33.4996, lng: 126.5312, zoom: 11 },
    gyeongju: { lat: 35.8562, lng: 129.2247, zoom: 13 },
    jeonju: { lat: 35.8242, lng: 127.148, zoom: 13 },
    gangneung: { lat: 37.7519, lng: 128.876, zoom: 12 },
    sokcho: { lat: 38.2044, lng: 128.5912, zoom: 12 },
    yeosu: { lat: 34.7604, lng: 127.6622, zoom: 12 },
    incheon: { lat: 37.4563, lng: 126.7052, zoom: 12 },
  };

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  city: string;
  district: string | null;
  place_type: string;
  postCount: number;
  photoUrl?: string | null;
  rating?: string | null;
  avg_rating?: number | null;
  google_rating?: number | null;
  hasVisited?: boolean;
  hasWant?: boolean;
  nationalities?: string[];
  genders?: string[];
}

interface CourseDayPlace {
  place_id: string;
  order: number;
  estimated_arrival: string;
  duration_min: number;
  activity: string;
  tip: string;
}

interface CourseDay {
  day: number;
  theme: string;
  places: CourseDayPlace[];
}

interface CourseData {
  title: string;
  summary: string;
  days: CourseDay[];
}

interface CourseSettings {
  startDate: string;
  endDate: string;
  transport: 'walking' | 'transit' | 'driving';
  vibe: 'recording' | 'foodie' | 'explorer' | 'relaxed';
  companion: 'solo' | 'couple' | 'friends' | 'family';
  timeRange: [number, number]; // slots: 0=06:00, 40=02:00, each slot=30min
  startLocation: string;
  endLocation: string;
  extraConditions: string;
  ragEnabled: boolean;
  ragMaxPlaces: number; // 0 = AI decides
}

function slotToTime(slot: number): string {
  const totalMinutes = 6 * 60 + slot * 30
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface Props {
  userId: string;
}

function PinMarker({
  color,
  selected,
  order,
  photoUrl,
  name,
  categoryLabel,
  rating,
  ratingLabel,
}: {
  color: string;
  selected: boolean;
  order?: number;
  photoUrl?: string | null;
  name: string;
  categoryLabel: string;
  rating?: string | null;
  ratingLabel?: string;
}) {
  // 동선 짜기 모드 - 순서 번호 원형
  if (order !== undefined) {
    return (
      <div
        className="flex items-center justify-center rounded-full text-white font-bold shadow-lg border-2 border-white"
        style={{ width: 28, height: 28, backgroundColor: color, fontSize: 11 }}
      >
        {order}
      </div>
    );
  }

  // 사진 있을 때 - 카드 스타일 핀
  if (photoUrl) {
    const width = selected ? 72 : 60;
    return (
      <div style={{ position: 'relative', width, display: 'inline-block' }}>
        <div
          style={{
            width,
            borderRadius: 8,
            overflow: 'hidden',
            border: `2px solid ${selected ? '#111' : 'white'}`,
            boxShadow: selected
              ? '0 4px 12px rgba(0,0,0,0.4)'
              : '0 2px 8px rgba(0,0,0,0.25)',
            backgroundColor: 'white',
            transition: 'all 0.15s',
          }}
        >
          {/* 사진 (4:3 비율) */}
          <div
            style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden' }}
          >
            <img
              src={photoUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
          {/* 장소명 + 카테고리 + 평점 */}
          <div style={{ padding: '2px 4px 3px', backgroundColor: 'white' }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#111',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
                marginBottom: 1,
              }}
            >
              {name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: color,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: 8,
                  color: '#888',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {categoryLabel}
              </span>
            </div>
            {rating && ratingLabel && RATING_COLORS[rating] && (
              <div
                style={{
                  marginTop: 2,
                  display: 'inline-block',
                  padding: '1px 4px',
                  borderRadius: 4,
                  backgroundColor: RATING_COLORS[rating],
                  color: 'white',
                  fontSize: 8,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {ratingLabel}
              </div>
            )}
          </div>
        </div>
        {/* 삼각형 포인터 */}
        <div
          style={{
            position: 'absolute',
            bottom: -5,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `5px solid ${selected ? '#111' : 'white'}`,
            filter: selected
              ? 'none'
              : 'drop-shadow(0 2px 2px rgba(0,0,0,0.15))',
          }}
        />
      </div>
    );
  }

  // 사진 없을 때 - 기본 컬러 핀
  return (
    <svg
      width={selected ? 22 : 16}
      height={selected ? 30 : 22}
      viewBox="0 0 16 22"
      style={{
        transition: 'all 0.15s',
        filter: selected
          ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
          : 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
      }}
    >
      <path
        d="M8 0C3.6 0 0 3.6 0 8c0 5.4 8 14 8 14s8-8.6 8-14C16 3.6 12.4 0 8 0z"
        fill={color}
      />
      <circle cx="8" cy="8" r="3" fill="white" opacity="0.9" />
    </svg>
  );
}

function CityNavigator({ city }: { city: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (!city) {
      map.panTo({ lat: 36.5, lng: 127.8 });
      map.setZoom(7);
    } else {
      const c = CITY_CENTERS[city];
      if (c) {
        map.panTo({ lat: c.lat, lng: c.lng });
        map.setZoom(c.zoom);
      }
    }
  }, [map, city]);
  return null;
}

function PlacePanner({ place }: { place: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !place) return;
    map.panTo({ lat: place.lat, lng: place.lng });
  }, [map, place?.id]);
  return null;
}

function RoutePolyline({
  points,
  color = '#1a1a1a',
  onActivate,
}: {
  points: { lat: number; lng: number }[];
  color?: string;
  onActivate?: () => void;
}) {
  const map = useMap();
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !points.length) return;
    if (polylineRef.current) polylineRef.current.setMap(null);
    polylineRef.current = new (window as any).google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight: 5,
    });
    polylineRef.current.setMap(map);
    if (onActivate) {
      polylineRef.current.addListener('click', onActivate);
      polylineRef.current.addListener('mouseover', onActivate);
    }
    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, [map, points, color]);

  return null;
}

export default function MapClient({ userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const locale = useLocale();
  const t = useTranslations('map');
  const tPost = useTranslations('post');
  const tCities = useTranslations('cities');
  const tDistricts = useTranslations('districts');

  // 지도 데이터 — 3분 캐싱 (재방문 시 즉시 로드)
  const { data: mapData } = useQuery({
    queryKey: ['map-data', userId],
    queryFn: async () => {
      const [{ data: posts }, { data: courses }] =
        await Promise.all([
          supabase
            .from('posts')
            .select(
              'place_id, photos, type, rating, profiles!user_id(nationality, gender), places!place_id(id, name, lat, lng, category, city, district, place_type, avg_rating)',
            )
            .eq('is_public', true)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('saved_courses')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        ]);

      const placeMap = new Map<string, any>();
      for (const post of posts || []) {
        const place = (post as any).places;
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
        if (!entry.photoUrl && (post.photos as string[])?.length > 0) {
          entry.photoUrl = (post.photos as string[])[0];
        }
        const nationality = (post.profiles as any)?.nationality;
        if (nationality) entry._nationalitySet.add(nationality);
        const gender = (post.profiles as any)?.gender;
        if (gender) entry._genderSet.add(gender);
        if ((post as any).type === 'visited') {
          entry.hasVisited = true;
          const r = (post as any).rating as string;
          if (r) entry._ratingCounts[r] = (entry._ratingCounts[r] || 0) + 1;
        } else if ((post as any).type === 'want') {
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
        savedCourses: courses || [],
      };
    },
    staleTime: 3 * 60 * 1000,
  });

  const allPlaces: Place[] = mapData?.allPlaces ?? [];
  const { data: interactions } = useUserInteractions(userId);
  const savedPlaceIds: Set<string> = interactions?.savedPlaceIds ?? new Set();

  // 기본 상태
  const [mode, setMode] = useState<'all' | 'saved'>('all');
  const [city, setCity] = useState<string | null>(null);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [nationalities, setNationalities] = useState<Set<string>>(new Set());
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('popular');
  const [viewMode, setViewMode] = useState<'all' | 'feed' | 'places'>('all');
  const [district, setDistrict] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [highlighted, setHighlighted] = useState<Place | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // 장소 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // 동선 짜기 상태
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
  const [accomResults, setAccomResults] = useState<any[]>([]);
  const [accomSearching, setAccomSearching] = useState(false);
  const [startLocQuery, setStartLocQuery] = useState('');
  const [startLocResults, setStartLocResults] = useState<any[]>([]);
  const [startLocSearching, setStartLocSearching] = useState(false);
  const [endLocQuery, setEndLocQuery] = useState('');
  const [endLocResults, setEndLocResults] = useState<any[]>([]);
  const [endLocSearching, setEndLocSearching] = useState(false);

  // Feature 2: 장소 추천받기
  const [showCourseTypePicker, setShowCourseTypePicker] = useState(false);
  const [recommendStep, setRecommendStep] = useState<'neighborhoods' | 'settings' | 'generating' | 'result'>('neighborhoods');
  const [recommendDistricts, setRecommendDistricts] = useState<string[]>([]);
  const [recommendCities, setRecommendCities] = useState<City[]>([]);
  const [recommendCityTab, setRecommendCityTab] = useState<City>('seoul');
  const [recommendPlaceCount, setRecommendPlaceCount] = useState<number | null>(null);
  const [showFewPlacesWarning, setShowFewPlacesWarning] = useState(false);
  const [showRecommendCalendar, setShowRecommendCalendar] = useState(false);
  const [courseSource, setCourseSource] = useState<'user_selected' | 'ai_recommended'>('user_selected');
  const [recommendSettings, setRecommendSettings] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    timeRange: [8, 32] as [number, number],
    styles: [] as string[],
    companion: 'friends' as 'solo' | 'couple' | 'friends' | 'family',
    extraConditions: '',
  });

  const [polylineTooltip, setPolylineTooltip] = useState<string | null>(null);
  const polylineTimerRef = useRef<any>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [saving, setSaving] = useState(false);
  // savedCourses: null = 아직 로드 전, 배열 = 로드됨 or 로컬 수정됨
  const [savedCoursesOverride, setSavedCoursesOverride] = useState<
    any[] | null
  >(null);
  const savedCourses = savedCoursesOverride ?? mapData?.savedCourses ?? [];
  const setSavedCourses = (v: any[]) => setSavedCoursesOverride(v);
  const [showSavedCourses, setShowSavedCourses] = useState(false);
  const [viewingCourseDay, setViewingCourseDay] = useState(1);
  const [selectedCoursePlace, setSelectedCoursePlace] = useState<string | null>(
    null,
  );
  // for the want list selection panel
  const [showWantPicker, setShowWantPicker] = useState(false);
  const [wantPlaces, setWantPlaces] = useState<Place[]>([]);

  // 장소 피드 시트
  const [placePosts, setPlacePosts] = useState<any[]>([]);
  const [placePostsLoading, setPlacePostsLoading] = useState(false);
  const [sheetPost, setSheetPost] = useState<any | null>(null);
  const [showPlaceReport, setShowPlaceReport] = useState(false);
  const [showPlaceMenu, setShowPlaceMenu] = useState(false);
  const [sheetSort, setSheetSort] = useState<'latest' | 'likes' | 'saves'>(
    'latest',
  );

  useEffect(() => {
    if (!selected) {
      setPlacePosts([]);
      return;
    }
    setPlacePostsLoading(true);
    supabase
      .from('posts')
      .select(
        'id, photos, type, rating, memo, recommended_menu, created_at, profiles!user_id(id, nickname, avatar_url, nationality), post_likes(count), post_saves(count)',
      )
      .eq('place_id', selected.id)
      .eq('is_public', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setPlacePosts(data || []);
        setPlacePostsLoading(false);
      });
  }, [selected?.id]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('accommodation_name, accommodation_address')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.accommodation_name) {
          setSavedAccommodation({
            name: data.accommodation_name,
            address: data.accommodation_address || '',
          });
        }
      });
  }, [userId]);

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

  async function searchLocation(q: string, setResults: (r: any[]) => void, setSearching: (v: boolean) => void) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.places || []);
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

  function showPolylineTooltip(text: string) {
    setPolylineTooltip(text);
    clearTimeout(polylineTimerRef.current);
    polylineTimerRef.current = setTimeout(() => setPolylineTooltip(null), 3000);
  }

  const sortedPlacePosts = [...placePosts].sort((a, b) => {
    if (sheetSort === 'likes')
      return (b.post_likes?.[0]?.count || 0) - (a.post_likes?.[0]?.count || 0);
    if (sheetSort === 'saves')
      return (b.post_saves?.[0]?.count || 0) - (a.post_saves?.[0]?.count || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const cityScroll = useDragScroll();
  const allCategories = [...new Set(allPlaces.map((p) => p.category))];

  function toggleCategory(cat: string) {
    setCategories((prev) => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  }

  function selectCity(c: string | null) {
    setCity(c);
    setDistrict(null);
  }

  function toggleNationality(nat: string) {
    setNationalities((prev) => {
      const n = new Set(prev);
      n.has(nat) ? n.delete(nat) : n.add(nat);
      return n;
    });
  }

  const places = allPlaces
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

  const visibleCategories = [...new Set(places.map((p) => p.category))];
  const districtList = city ? getMainDistricts(city as City) : [];

  // 장소 검색 필터
  const searchResults = searchQuery.trim().length > 0
    ? allPlaces.filter(p =>
        p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ).slice(0, 5)
    : [];

  function handleSearchSelect(place: Place) {
    setHighlighted(place);
    setSearchQuery('');
    setShowSearchDropdown(false);
    if (place.city) {
      setCity(place.city);
    }
  }

  const hasActiveFilters =
    categories.size > 0 ||
    nationalities.size > 0 ||
    genderFilter != null ||
    hiddenOnly ||
    viewMode !== 'all' ||
    minRating != null ||
    district != null;

  function exitCourseMode() {
    setMapMode('normal');
    setBuildStep('select');
    setCourseSelection([]);
    setCourseData(null);
    setCourseTitle('');
    setViewingCourseDay(1);
    setSelectedCoursePlace(null);
  }

  async function loadWantPlaces() {
    const { data } = await supabase
      .from('posts')
      .select(
        'place_id, places!place_id(id, name, lat, lng, category, city, district, place_type, avg_rating)',
      )
      .eq('user_id', userId)
      .eq('type', 'want')
      .is('deleted_at', null);
    const places = (data || [])
      .map((r: any) => r.places)
      .filter(Boolean)
      .filter(
        (p: any, i: number, arr: any[]) =>
          arr.findIndex((x) => x.id === p.id) === i,
      );
    setWantPlaces(places);
  }

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
      const data = await res.json();
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
          days: Math.max(1, Math.round((new Date(courseSettings.endDate).getTime() - new Date(courseSettings.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1),
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
      setSavedCourses([data, ...savedCourses]);
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
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCourseData(data);
      setRecommendStep('result');
      setMapMode('course-view');
      setViewingCourseDay(1);
      // 추천된 장소들을 courseSelection에 세팅 (폴리라인 표시용)
      if (data.days) {
        const allPlaceIds = data.days.flatMap((d: any) => d.places.map((p: any) => p.place_id));
        const { data: placesData } = await supabase
          .from('places')
          .select('id, name, category, district, city, lat, lng, avg_rating, place_type')
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
    let query = supabase.from('places').select('id', { count: 'exact', head: true });
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

  async function handleLoadCourse(course: any) {
    const loadedCourseData: CourseData = course.course_data;
    if (!loadedCourseData) return;
    const allPlaceIds = loadedCourseData.days.flatMap((d: any) =>
      d.places.map((p: any) => p.place_id),
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
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} language={locale}>
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
                .map((p) => allPlaces.find((pl) => pl.id === p.place_id) ?? courseSelection.find((pl) => pl.id === p.place_id))
                .filter(Boolean) as Place[];
              if (dayPlaces.length < 2) return null;
              const color = DAY_COLORS[(day.day - 1) % DAY_COLORS.length];
              return (
                <RoutePolyline
                  key={day.day}
                  points={dayPlaces.map((p) => ({ lat: p.lat, lng: p.lng }))}
                  color={color}
                  onActivate={() =>
                    showPolylineTooltip(`Day ${day.day} · ${day.theme}`)
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
                  const place = allPlaces.find((pl) => pl.id === p.place_id) ?? courseSelection.find((pl) => pl.id === p.place_id);
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
                    selected={selected?.id === place.id || isSelected || highlighted?.id === place.id}
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

      {/* 상단 필터 */}
      {mapMode !== 'course-view' && (
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
          <div className="max-w-lg mx-auto px-3 pt-3 flex flex-col gap-2">
            {/* 장소 검색바 - normal + course-build 모드 */}
            {(mapMode === 'normal' || mapMode === 'course-build') && (
              <div className="relative pointer-events-auto">
                <div className="flex items-center bg-white rounded-full shadow px-3 py-2 gap-2">
                  <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
                    placeholder={t('searchPlaceholder')}
                    className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
                  />
                  {searchQuery && (
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
                      className="text-gray-400"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    {searchResults.map(place => (
                      <button
                        key={place.id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleSearchSelect(place)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                      >
                        <span className="text-base shrink-0">
                          {place.category === 'cafe' ? '☕' : place.category === 'restaurant' ? '🍽️' : place.category === 'photospot' ? '📸' : place.category === 'bar' ? '🍻' : place.category === 'culture' ? '🎨' : place.category === 'nature' ? '🌿' : place.category === 'shopping' ? '🛍️' : '🚶'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{place.name}</p>
                          {place.city && (
                            <p className="text-xs text-gray-400 truncate">{tCities(place.city)}{place.district && place.district !== 'other' ? ` · ${place.district}` : ''}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* 필터 버튼 - course-build 모드 전용 (normal은 아래 액션 버튼에 포함) */}
            {mapMode === 'course-build' && (
              <div className="flex justify-end pointer-events-auto">
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`bg-white rounded-full shadow p-2 ${hasActiveFilters ? 'ring-2 ring-gray-900' : ''}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <line x1="11" y1="18" x2="13" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            {/* 액션 버튼 - normal 모드만 */}
            {mapMode === 'normal' && (
              <div className="flex gap-2 pointer-events-auto">
                <div className="bg-white rounded-full shadow flex p-1 gap-0.5">
                  {(['all', 'saved'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === m ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                    >
                      {t(m)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 ml-auto">
                  <button
                    onClick={() => setShowSavedCourses(true)}
                    className="bg-white rounded-full shadow p-2 pointer-events-auto"
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setShowCourseTypePicker(true);
                      setSelected(null);
                    }}
                    className="bg-gray-900 rounded-full shadow px-3 py-2 flex items-center gap-1.5 pointer-events-auto"
                  >
                    <svg
                      width="14"
                      height="14"
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
                    <span className="text-xs font-medium text-white">{t('course.label')}</span>
                  </button>
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className={`bg-white rounded-full shadow p-2 pointer-events-auto ${hasActiveFilters ? 'ring-2 ring-gray-900' : ''}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                      <line x1="11" y1="18" x2="13" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {/* 도시 칩 */}
            <div
              ref={cityScroll.ref}
              onMouseDown={cityScroll.onMouseDown}
              onMouseMove={cityScroll.onMouseMove}
              onMouseUp={cityScroll.onMouseUp}
              onMouseLeave={cityScroll.onMouseLeave}
              className="flex gap-1.5 overflow-x-auto scrollbar-hide pointer-events-auto pb-0.5 cursor-grab select-none"
            >
              <button
                onClick={() => selectCity(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium shadow transition-colors ${!city ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
              >
                {t('all')}
              </button>
              {CITIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => selectCity(city === c.value ? null : c.value)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium shadow transition-colors ${city === c.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
                >
                  {tCities(c.value)}
                </button>
              ))}
            </div>
            {/* 동네 칩 */}
            {city && districtList.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pointer-events-auto pb-0.5 cursor-grab select-none">
                {districtList.map((d) => (
                  <button
                    key={d.value}
                    onClick={() =>
                      setDistrict(district === d.value ? null : d.value)
                    }
                    className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium shadow transition-colors ${district === d.value ? 'bg-gray-700 text-white' : 'bg-white/90 text-gray-600'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            {/* 필터 패널은 하단 fixed 모달로 이동됨 */}
          </div>
        </div>
      )}

      {/* 동선 짜기 모드 - 하단 바 */}
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
              <p className="text-sm font-bold text-gray-900">{t('course.buildTitle')}</p>
              <p className="text-xs text-gray-400">
                {courseSelection.length === 0
                  ? t('course.tapToSelect')
                  : t('course.selectedCount', { count: courseSelection.length })}
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
                  {t('course.dayPlaces', { days: Math.max(1, Math.round((new Date(courseSettings.endDate).getTime() - new Date(courseSettings.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1), count: courseSelection.length })}
                </p>
              </div>
              <button
                onClick={() => {
                  const url =
                    window.location.origin +
                    '/course/' +
                    (savedCourses[0]?.id || '');
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

      {/* 핀 수 */}
      {mapMode === 'normal' && places.length > 0 && !selected && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            {places.length}
            {t('placeCount')}
          </div>
        </div>
      )}

      {/* 장소 피드 바텀시트 */}
      {selected && mapMode === 'normal' && (
        <div
          className="fixed inset-0 z-60 flex items-end justify-center bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl flex flex-col mb-16"
            style={{ maxHeight: 'calc(72vh - 64px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* 장소 헤더 */}
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    backgroundColor:
                      (CATEGORY_COLOR[selected.category] || '#607D8B') + '20',
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        CATEGORY_COLOR[selected.category] || '#607D8B',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {selected.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tPost(`category.${selected.category}`)} ·{' '}
                    {tCities(selected.city)}
                    {selected.district && selected.district !== 'other'
                      ? ` · ${tDistricts(`${selected.city}.${selected.district}`)}`
                      : ''}
                    {selected.place_type === 'hidden_spot' && (
                      <span className="ml-1 text-purple-400">
                        {tPost('hiddenSpot')}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {selected.google_rating != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                        <span className="text-yellow-400">★</span>
                        {selected.google_rating.toFixed(1)}
                        <span className="text-gray-400 font-normal">구글</span>
                      </span>
                    )}
                    {selected.rating && RATING_COLORS[selected.rating] && (
                      <span
                        className="text-white text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: RATING_COLORS[selected.rating],
                        }}
                      >
                        {tPost(`rating.${selected.rating}`)}
                      </span>
                    )}
                    {(selected.category === 'cafe' ||
                      selected.category === 'restaurant' ||
                      selected.category === 'bar') && (
                      <a
                        href={`https://map.naver.com/v5/search/${encodeURIComponent(selected.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"
                      >
                        🗺 {t('naverMenu')}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative">
                    <button onClick={() => setShowPlaceMenu(v => !v)} className="p-1 text-gray-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {showPlaceMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowPlaceMenu(false)} />
                        <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[100px]">
                          <button
                            onClick={() => { setShowPlaceMenu(false); setShowPlaceReport(true) }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                              className="rounded border border-red-200 text-red-400 p-0.5 box-content">
                              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                              <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" />
                            </svg>
                            신고
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/place/${selected.id}`)}
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-xl font-medium"
                  >
                    {t('detail')}
                  </button>
                </div>
              </div>
            </div>
            {showPlaceReport && (
              <ReportSheet targetType="place" targetId={selected.id} onClose={() => setShowPlaceReport(false)} />
            )}

            {/* 포스트 피드 - 3열 그리드 */}
            <div className="overflow-y-auto flex-1 pb-4">
              {/* 정렬 */}
              <div className="flex gap-1.5 px-4 py-2 border-b border-gray-100">
                {(
                  [
                    { key: 'latest', label: t('course.sortLatest') },
                    { key: 'likes', label: t('course.sortLikes') },
                    { key: 'saves', label: t('course.sortSaves') },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSheetSort(opt.key)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${sheetSort === opt.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {placePostsLoading ? (
                <div className="flex items-center justify-center py-10 text-xs text-gray-400">
                  {t('loading')}
                </div>
              ) : sortedPlacePosts.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-xs text-gray-400">
                  {t('noPostsLabel')}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-0.5 p-0.5">
                    {sortedPlacePosts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => setSheetPost(post)}
                        className="aspect-square bg-gray-100 relative overflow-hidden"
                      >
                        {post.photos?.[0] ? (
                          <img
                            src={post.photos[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            📷
                          </div>
                        )}
                        {post.type === 'visited' && post.rating && (
                          <div
                            className="absolute top-1 left-1 w-2 h-2 rounded-full border border-white"
                            style={{
                              backgroundColor: RATING_COLORS[post.rating],
                            }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 포스트 상세 모달 */}
      {sheetPost && (
        <div
          className="fixed inset-0 bg-black/60 z-60 flex items-end justify-center"
          onClick={() => setSheetPost(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>
            {/* 유저 헤더 */}
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0">
                {sheetPost.profiles?.avatar_url ? (
                  <img
                    src={sheetPost.profiles.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                    {sheetPost.profiles?.nickname?.[0]}
                  </div>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900 flex-1">
                {sheetPost.profiles?.nickname}
              </span>
              {sheetPost.type === 'visited' && sheetPost.rating && (
                <span
                  className="text-white text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: RATING_COLORS[sheetPost.rating] }}
                >
                  {tPost(`rating.${sheetPost.rating}`)}
                </span>
              )}
              {sheetPost.type === 'want' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                  {t('wantTag')}
                </span>
              )}
            </div>
            {/* 사진 */}
            {sheetPost.photos?.[0] && (
              <div className="aspect-square bg-gray-100">
                <img
                  src={sheetPost.photos[0]}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {/* 메모 + 추천 메뉴 */}
            <div className="px-4 py-3 pb-8 flex flex-col gap-3">
              {sheetPost.recommended_menu && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-50 rounded-xl">
                  <span className="text-base shrink-0">🍽</span>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-500 mb-0.5">
                      {t('menuLabel')}
                    </p>
                    <p className="text-sm text-gray-800">
                      {sheetPost.recommended_menu}
                    </p>
                  </div>
                </div>
              )}
              {sheetPost.memo && (
                <p className="text-sm text-gray-700 leading-relaxed">
                  {sheetPost.memo}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 장소 없을 때 */}
      {places.length === 0 && mapMode === 'normal' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-white rounded-2xl shadow px-6 py-4 text-center">
            <p className="text-sm text-gray-400">{t('noPlaces')}</p>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {mapMode === 'course-build' && buildStep === 'settings' && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 lg:p-0"
          onClick={() => setBuildStep('select')}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl max-h-[85vh] shadow-[0_4px_24px_rgba(0,0,0,0.15)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900">{t('course.travelConditions')}</h2>
              <button onClick={() => setBuildStep('select')} className="text-gray-400 p-1 -mr-1">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-5 pb-6 pt-5 flex flex-col gap-4 overflow-y-auto">

              {/* 여행 날짜 범위 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.startDate')} ~ {t('course.endDate')}</p>
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-left flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900">
                    {courseSettings.startDate} ~ {courseSettings.endDate}
                  </span>
                  <span className="text-xs text-gray-400">
                    {Math.max(1, Math.round((new Date(courseSettings.endDate).getTime() - new Date(courseSettings.startDate).getTime()) / (1000*60*60*24))+1)}일
                  </span>
                </button>
                {showCalendar && (
                  <div className="mt-2 flex justify-center border border-gray-100 rounded-xl p-2 bg-white">
                    <DayPicker
                      mode="range"
                      selected={{ from: new Date(courseSettings.startDate), to: new Date(courseSettings.endDate) }}
                      onSelect={(range: DateRange | undefined) => {
                        if (range?.from) {
                          const from = range.from.toISOString().slice(0, 10)
                          const to = (range.to ?? range.from).toISOString().slice(0, 10)
                          setCourseSettings(s => ({ ...s, startDate: from, endDate: to }))
                          if (range.to) setShowCalendar(false)
                        }
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">{t('course.startDateHint')}</p>
              </div>

              {/* 이동수단 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  {t('course.transport')}
                </p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: 'transit', label: t('course.transportTransit') },
                      { value: 'walking', label: t('course.transportWalking') },
                      { value: 'driving', label: t('course.transportDriving') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setCourseSettings((s) => ({
                          ...s,
                          transport: opt.value,
                        }))
                      }
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${courseSettings.transport === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 여행 분위기 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.vibe')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: 'relaxed', label: t('course.vibeRelaxed') },
                      { value: 'recording', label: t('course.vibeRecording') },
                      { value: 'foodie', label: t('course.vibeFoodie') },
                      { value: 'explorer', label: t('course.vibeExplorer') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCourseSettings((s) => ({ ...s, vibe: opt.value }))}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors ${courseSettings.vibe === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 동반자 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  {t('course.companion')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { value: 'solo', label: t('course.companionSolo') },
                      { value: 'couple', label: t('course.companionCouple') },
                      { value: 'friends', label: t('course.companionFriends') },
                      { value: 'family', label: t('course.companionFamily') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setCourseSettings((s) => ({
                          ...s,
                          companion: opt.value,
                        }))
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${courseSettings.companion === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 활동 시간 슬라이더 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">{t('course.timeRange')}</p>
                <p className="text-[10px] text-gray-400 mb-3">{t('course.timeRangeHint')}</p>
                <div className="flex items-center justify-between text-xs font-medium text-gray-900 mb-2">
                  <span>{slotToTime(courseSettings.timeRange[0])}</span>
                  <span>{slotToTime(courseSettings.timeRange[1])}</span>
                </div>
                <div className="px-2">
                  <Range
                    step={1}
                    min={0}
                    max={40}
                    values={courseSettings.timeRange}
                    onChange={(vals) => setCourseSettings(s => ({ ...s, timeRange: vals as [number, number] }))}
                    renderTrack={({ props, children }) => (
                      <div
                        {...props}
                        style={{
                          ...props.style,
                          height: '4px',
                          borderRadius: '2px',
                          background: getTrackBackground({
                            values: courseSettings.timeRange,
                            colors: ['#e5e7eb', '#111827', '#e5e7eb'],
                            min: 0,
                            max: 40,
                          }),
                        }}
                      >
                        {children}
                      </div>
                    )}
                    renderThumb={({ props, index }) => {
                      const { key, ...restProps } = props
                      return (
                        <div
                          key={key}
                          {...restProps}
                          style={{
                            ...restProps.style,
                            height: '24px',
                            width: '24px',
                            backgroundColor: '#111827',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          }}
                        />
                      )
                    }}
                  />
                </div>
              </div>

              {/* 내 숙소 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  {t('course.accommodation')}
                </p>
                {savedAccommodation && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 rounded-xl mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {savedAccommodation.name}
                      </p>
                      {savedAccommodation.address && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {savedAccommodation.address}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSavedAccommodation(null);
                        supabase
                          .from('profiles')
                          .update({
                            accommodation_name: null,
                            accommodation_address: null,
                          })
                          .eq('id', userId);
                      }}
                      className="shrink-0 p-1 text-gray-400"
                    >
                      <svg
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        viewBox="0 0 24 24"
                      >
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={accomQuery}
                    onChange={(e) => {
                      setAccomQuery(e.target.value);
                      if (!e.target.value) setAccomResults([]);
                    }}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && searchAccomPlaces(accomQuery)
                    }
                    placeholder={t('course.accomPlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={() => searchAccomPlaces(accomQuery)}
                    disabled={accomSearching || !accomQuery.trim()}
                    className="shrink-0 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium disabled:opacity-40"
                  >
                    {accomSearching ? '...' : t('course.search')}
                  </button>
                </div>
                {accomResults.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1 border border-gray-100 rounded-xl overflow-hidden">
                    {accomResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => saveAccommodation(r.name, r.address)}
                        className="text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {r.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {r.address}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 출발지 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.startLocation')}</p>
                {savedAccommodation ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={courseSettings.startLocation}
                      onChange={(e) => setCourseSettings((s) => ({ ...s, startLocation: e.target.value }))}
                      placeholder={t('course.startLocationPlaceholder')}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                    />
                    <button
                      onClick={() => setCourseSettings((s) => ({ ...s, startLocation: savedAccommodation.name }))}
                      className="shrink-0 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium whitespace-nowrap"
                    >
                      {t('course.useAccom')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={startLocQuery || courseSettings.startLocation}
                        onChange={(e) => {
                          setStartLocQuery(e.target.value);
                          setCourseSettings((s) => ({ ...s, startLocation: e.target.value }));
                          if (!e.target.value) setStartLocResults([]);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && searchLocation(startLocQuery, setStartLocResults, setStartLocSearching)}
                        placeholder={t('course.startLocationPlaceholder')}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                      />
                      <button
                        onClick={() => searchLocation(startLocQuery, setStartLocResults, setStartLocSearching)}
                        disabled={startLocSearching || !startLocQuery.trim()}
                        className="shrink-0 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium disabled:opacity-40"
                      >
                        {startLocSearching ? '...' : t('course.search')}
                      </button>
                    </div>
                    {startLocResults.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0 border border-gray-100 rounded-xl overflow-hidden">
                        {startLocResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setCourseSettings((s) => ({ ...s, startLocation: r.name }));
                              setStartLocQuery(r.name);
                              setStartLocResults([]);
                            }}
                            className="text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.address}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 도착지 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.endLocation')}</p>
                {savedAccommodation ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={courseSettings.endLocation}
                      onChange={(e) => setCourseSettings((s) => ({ ...s, endLocation: e.target.value }))}
                      placeholder={t('course.endLocationPlaceholder')}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                    />
                    <button
                      onClick={() => setCourseSettings((s) => ({ ...s, endLocation: savedAccommodation.name }))}
                      className="shrink-0 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium whitespace-nowrap"
                    >
                      {t('course.useAccom')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={endLocQuery || courseSettings.endLocation}
                        onChange={(e) => {
                          setEndLocQuery(e.target.value);
                          setCourseSettings((s) => ({ ...s, endLocation: e.target.value }));
                          if (!e.target.value) setEndLocResults([]);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && searchLocation(endLocQuery, setEndLocResults, setEndLocSearching)}
                        placeholder={t('course.endLocationPlaceholder')}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                      />
                      <button
                        onClick={() => searchLocation(endLocQuery, setEndLocResults, setEndLocSearching)}
                        disabled={endLocSearching || !endLocQuery.trim()}
                        className="shrink-0 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium disabled:opacity-40"
                      >
                        {endLocSearching ? '...' : t('course.search')}
                      </button>
                    </div>
                    {endLocResults.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0 border border-gray-100 rounded-xl overflow-hidden">
                        {endLocResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setCourseSettings((s) => ({ ...s, endLocation: r.name }));
                              setEndLocQuery(r.name);
                              setEndLocResults([]);
                            }}
                            className="text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.address}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RAG 추가 장소 */}
              <div>
                <button
                  onClick={() => setCourseSettings(s => ({ ...s, ragEnabled: !s.ragEnabled }))}
                  className={`w-full flex items-start justify-between px-4 py-3 rounded-xl border transition-colors ${courseSettings.ragEnabled ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium text-gray-900">{t('course.ragToggle')}</span>
                    <span className="text-xs text-gray-400 text-left">{t('course.ragToggleDesc')}</span>
                  </div>
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${courseSettings.ragEnabled ? 'border-gray-900 bg-gray-900' : 'border-gray-300'}`} />
                </button>
                {courseSettings.ragEnabled && (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-gray-500">{t('course.ragMaxPlaces')}</p>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setCourseSettings(s => ({ ...s, ragMaxPlaces: n }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${courseSettings.ragMaxPlaces === n ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {n === 0 ? t('course.ragMaxAuto') : t('course.ragMaxCount', { n })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 기타 조건 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  {t('course.extraConditions')}
                </p>
                <p className="text-[10px] text-gray-400 mb-2">
                  {t('course.extraConditionsHint')}
                </p>
                <textarea
                  value={courseSettings.extraConditions}
                  onChange={(e) =>
                    setCourseSettings((s) => ({
                      ...s,
                      extraConditions: e.target.value,
                    }))
                  }
                  placeholder={t('course.extraConditionsPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
                />
              </div>

              <button
                onClick={handleGenerateCourse}
                disabled={courseLoading}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                {courseLoading ? t('course.generating') : t('course.generateBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 생성 중 오버레이 */}
      {mapMode === 'course-build' && buildStep === 'generating' && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-8 flex flex-col items-center gap-4 max-w-xs mx-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                className="animate-spin"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">
                {t('course.generatingTitle')}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {t('course.analyzingPlaces', { count: courseSelection.length })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 코스 결과 바텀시트 */}
      {mapMode === 'course-view' && courseData && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center mb-16">
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl shadow-xl"
            style={{ maxHeight: 'calc(50vh - 64px)' }}
          >
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Day 탭 */}
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

            {/* 해당 Day 장소 목록 */}
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
                        const place = allPlaces.find((pl) => pl.id === p.place_id) ?? courseSelection.find((pl) => pl.id === p.place_id);
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

              {/* 저장 영역 */}
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

      {/* 가고싶어 목록 피커 */}
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

      {/* 저장된 코스 목록 */}
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
              {savedCourses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  {t('course.noSavedCourses')}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedCourses.map((course: any) => (
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
                          {t('course.dayPlaces', { days: course.days, count: (course.place_ids || []).length })}
                          ·{' '}
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

      {/* 동선 툴팁 */}
      {polylineTooltip && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
          <div className="bg-gray-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            {polylineTooltip}
          </div>
        </div>
      )}

      {/* 동선 타입 선택 모달 */}
      {showCourseTypePicker && (
        <div className="fixed inset-0 z-40 flex items-end pointer-events-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCourseTypePicker(false)} />
          <div className="relative w-full bg-white rounded-t-2xl px-4 pt-5 pb-8 mb-16">
            <h2 className="text-base font-bold text-gray-900 mb-1">{t('recommend.pickTitle')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('recommend.pickDesc')}</p>
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
                  <svg width="18" height="18" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('recommend.pickFeature1')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('recommend.pickFeature1Desc')}</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowCourseTypePicker(false);
                  setMapMode('recommend-build');
                  setRecommendStep('neighborhoods');
                  setRecommendDistricts([]);
                  setRecommendCities([]);
                  setRecommendPlaceCount(null);
                  setShowFewPlacesWarning(false);
                }}
                className="flex items-center gap-3 px-4 py-3.5 border-2 border-gray-200 rounded-xl text-left"
              >
                <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <svg width="18" height="18" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('recommend.pickFeature2')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('recommend.pickFeature2Desc')}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 2: 장소 추천받기 시트 */}
      {mapMode === 'recommend-build' && recommendStep !== 'generating' && (
        <div className="fixed inset-x-0 bottom-16 z-40 pointer-events-auto">
          <div className="bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {recommendStep === 'settings' && (
                  <button onClick={() => setRecommendStep('neighborhoods')} className="p-1 -ml-1">
                    <svg width="18" height="18" fill="none" stroke="#374151" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M15 19l-7-7 7-7" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <h2 className="text-base font-bold text-gray-900">
                  {recommendStep === 'neighborhoods' ? t('recommend.neighborhoodsTitle') : t('recommend.settingsTitle')}
                </h2>
              </div>
              <button
                onClick={() => { setMapMode('normal'); setRecommendStep('neighborhoods'); }}
                className="p-1.5 rounded-full bg-gray-100"
              >
                <svg width="14" height="14" fill="none" stroke="#6B7280" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-6 pt-3">
              {/* STEP 1: 동네 선택 */}
              {recommendStep === 'neighborhoods' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-500">{t('recommend.neighborhoodsSubtitle')}</p>

                  {/* 도시 탭 */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CITIES.map(city => (
                      <button
                        key={city.value}
                        onClick={() => setRecommendCityTab(city.value as City)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${recommendCityTab === city.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {city.label}
                      </button>
                    ))}
                  </div>

                  {/* 선택된 동네 chips */}
                  {recommendDistricts.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {recommendDistricts.map(d => (
                        <span key={d} className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-full">
                          {d}
                          <button onClick={() => setRecommendDistricts(prev => prev.filter(x => x !== d))}>
                            <svg width="10" height="10" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 현재 도시의 동네 목록 */}
                  {(() => {
                    const districtList = getDistricts(recommendCityTab)
                    return (
                      <div className="flex flex-wrap gap-2">
                        {districtList.map((d: { value: string; label: string }) => {
                          const selected = recommendDistricts.includes(d.value)
                          return (
                            <button
                              key={d.value}
                              onClick={() => setRecommendDistricts(prev =>
                                selected ? prev.filter(x => x !== d.value) : [...prev, d.value]
                              )}
                              className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {d.label}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* 경고 모달 (장소 부족) */}
                  {showFewPlacesWarning && recommendPlaceCount !== null && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3">
                      <p className="text-sm text-amber-800">{t('recommend.fewPlacesWarning', { n: recommendPlaceCount })}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowFewPlacesWarning(false); setRecommendStep('settings'); }}
                          className="flex-1 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl"
                        >
                          {t('recommend.fewPlacesContinue')}
                        </button>
                        <button
                          onClick={() => { setMapMode('normal'); setShowFewPlacesWarning(false); }}
                          className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-xl"
                        >
                          {t('recommend.fewPlacesAdd')}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={checkRecommendPlaceCount}
                    disabled={recommendDistricts.length === 0}
                    className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
                  >
                    {t('recommend.next')}
                  </button>
                </div>
              )}

              {/* STEP 2: 여행 조건 */}
              {recommendStep === 'settings' && (
                <div className="flex flex-col gap-4">
                  {/* 날짜 범위 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.startDate')} ~ {t('course.endDate')}</p>
                    <button
                      onClick={() => setShowRecommendCalendar(!showRecommendCalendar)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-left flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-900">
                        {recommendSettings.startDate} ~ {recommendSettings.endDate}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.max(1, Math.round((new Date(recommendSettings.endDate).getTime() - new Date(recommendSettings.startDate).getTime()) / (1000*60*60*24))+1)}일
                      </span>
                    </button>
                    {showRecommendCalendar && (
                      <div className="mt-2 flex justify-center border border-gray-100 rounded-xl p-2 bg-white">
                        <DayPicker
                          mode="range"
                          selected={{ from: new Date(recommendSettings.startDate), to: new Date(recommendSettings.endDate) }}
                          onSelect={(range: DateRange | undefined) => {
                            if (range?.from) {
                              const from = range.from.toISOString().slice(0, 10)
                              const to = (range.to ?? range.from).toISOString().slice(0, 10)
                              setRecommendSettings(s => ({ ...s, startDate: from, endDate: to }))
                              if (range.to) setShowRecommendCalendar(false)
                            }
                          }}
                          disabled={{ before: new Date() }}
                        />
                      </div>
                    )}
                  </div>

                  {/* 활동 시간 슬라이더 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t('course.timeRange')}</p>
                    <div className="flex items-center justify-between text-xs font-medium text-gray-900 mb-2">
                      <span>{slotToTime(recommendSettings.timeRange[0])}</span>
                      <span>{slotToTime(recommendSettings.timeRange[1])}</span>
                    </div>
                    <div className="px-2">
                      <Range
                        step={1}
                        min={0}
                        max={40}
                        values={recommendSettings.timeRange}
                        onChange={(vals) => setRecommendSettings(s => ({ ...s, timeRange: vals as [number, number] }))}
                        renderTrack={({ props, children }) => (
                          <div
                            {...props}
                            style={{
                              ...props.style,
                              height: '4px',
                              borderRadius: '2px',
                              background: getTrackBackground({
                                values: recommendSettings.timeRange,
                                colors: ['#e5e7eb', '#111827', '#e5e7eb'],
                                min: 0,
                                max: 40,
                              }),
                            }}
                          >
                            {children}
                          </div>
                        )}
                        renderThumb={({ props }) => {
                          const { key, ...restProps } = props
                          return (
                            <div
                              key={key}
                              {...restProps}
                              style={{
                                ...restProps.style,
                                height: '24px',
                                width: '24px',
                                backgroundColor: '#111827',
                                borderRadius: '50%',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                              }}
                            />
                          )
                        }}
                      />
                    </div>
                  </div>

                  {/* 여행 스타일 (카테고리 멀티셀렉) */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{t('recommend.styles')}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(['cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping'] as const).map(cat => {
                        const selected = recommendSettings.styles.includes(cat)
                        return (
                          <button
                            key={cat}
                            onClick={() => setRecommendSettings(s => ({
                              ...s,
                              styles: selected ? s.styles.filter(x => x !== cat) : [...s.styles, cat],
                            }))}
                            className={`py-2 rounded-xl text-xs font-medium transition-colors ${selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {CATEGORY_EMOJIS[cat]}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(['cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping'] as const).map(cat => {
                        const selected = recommendSettings.styles.includes(cat)
                        return selected ? (
                          <span key={cat} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                            {tPost(`category.${cat}`)}
                          </span>
                        ) : null
                      })}
                    </div>
                  </div>

                  {/* 동반자 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.companion')}</p>
                    <div className="flex gap-2 flex-wrap">
                      {(
                        [
                          { value: 'solo', label: t('course.companionSolo') },
                          { value: 'couple', label: t('course.companionCouple') },
                          { value: 'friends', label: t('course.companionFriends') },
                          { value: 'family', label: t('course.companionFamily') },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setRecommendSettings(s => ({ ...s, companion: opt.value }))}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${recommendSettings.companion === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 기타 조건 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t('course.extraConditions')}</p>
                    <p className="text-[10px] text-gray-400 mb-1">{t('course.extraConditionsHint')}</p>
                    <textarea
                      value={recommendSettings.extraConditions}
                      onChange={e => setRecommendSettings(s => ({ ...s, extraConditions: e.target.value }))}
                      placeholder={t('course.extraConditionsPlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleRecommendCourse}
                    className="w-full py-3.5 bg-purple-600 text-white rounded-xl text-sm font-semibold"
                  >
                    {t('recommend.generateBtn')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feature 2 generating overlay */}
      {mapMode === 'recommend-build' && recommendStep === 'generating' && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-white/90 pointer-events-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-gray-900">{t('recommend.generatingTitle')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('recommend.analyzingData')}</p>
            </div>
          </div>
        </div>
      )}

      {/* 필터 모달 */}
      {mapMode === 'normal' && showFilters && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4 pointer-events-auto"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl p-3 flex flex-col gap-3 overflow-y-auto"
            style={{ maxHeight: '70vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{t('filter')}</p>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setCategories(new Set());
                      setNationalities(new Set());
                      setGenderFilter(null);
                      setHiddenOnly(false);
                      setViewMode('all');
                      setMinRating(null);
                      setSortBy('popular');
                    }}
                    className="text-xs text-gray-400 underline"
                  >
                    {t('resetFilter')}
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-full"
                >
                  {t('applyFilter')}
                </button>
              </div>
            </div>

            {/* 보기 모드 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterView')}</p>
              <div className="flex gap-1.5">
                {(['all', 'feed', 'places'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${viewMode === v ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    {v === 'all' ? t('viewAll') : v === 'feed' ? t('viewFeed') : t('viewPlaces')}
                  </button>
                ))}
              </div>
            </div>

            {/* 정렬 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">{t('sort')}</p>
              <div className="flex gap-1.5">
                {(['popular', 'latest'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${sortBy === s ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    {t(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* 평점 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">{t('avgRating')}</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setMinRating(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${minRating == null ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {t('all')}
                </button>
                {[
                  { score: 4, label: tPost('rating.must_go'), color: RATING_COLORS.must_go },
                  { score: 3, label: tPost('rating.worth_it'), color: RATING_COLORS.worth_it },
                  { score: 2, label: tPost('rating.neutral'), color: RATING_COLORS.neutral },
                ].map((r) => (
                  <button
                    key={r.score}
                    onClick={() => setMinRating(minRating === r.score ? null : r.score)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={minRating === r.score ? { backgroundColor: r.color, color: 'white', borderColor: 'transparent' } : { backgroundColor: 'white', color: '#4B5563', borderColor: '#E5E7EB' }}
                  >
                    {r.label} {t('above')}
                  </button>
                ))}
              </div>
            </div>

            {/* 카테고리 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">{t('category')}</p>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${categories.has(cat) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                    style={categories.has(cat) ? { backgroundColor: CATEGORY_COLOR[cat] } : {}}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categories.has(cat) ? 'white' : CATEGORY_COLOR[cat] }} />
                    {tPost(`category.${cat}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* 히든스팟 */}
            <div>
              <button
                onClick={() => setHiddenOnly((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${hiddenOnly ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                <span>🔍</span>
                {tPost('hiddenSpotOnly')}
              </button>
            </div>

            {/* 국적 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">{t('nationality')}</p>
              <div className="flex flex-wrap gap-1.5">
                {NATIONALITY_CHIPS.map(({ code, flag }) => (
                  <button
                    key={code}
                    onClick={() => toggleNationality(code)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${nationalities.has(code) ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    <span>{flag}</span>
                    <span>{code}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 성별 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">{t('authorGender')}</p>
              <div className="flex gap-2">
                {([
                  { key: null, label: t('genderAll') },
                  { key: 'female', label: t('genderFemale') },
                  { key: 'male', label: t('genderMale') },
                ] as const).map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setGenderFilter(opt.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${genderFilter === opt.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
