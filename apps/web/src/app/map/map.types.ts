export interface Place {
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

export interface CourseDayPlace {
  place_id: string;
  order: number;
  estimated_arrival: string;
  duration_min: number;
  activity: string;
  tip: string;
}

export interface CourseDay {
  day: number;
  theme: string;
  places: CourseDayPlace[];
}

export interface CourseData {
  title: string;
  summary: string;
  days: CourseDay[];
}

export interface CourseSettings {
  startDate: string;
  endDate: string;
  transport: 'walking' | 'transit' | 'driving';
  vibe: 'recording' | 'foodie' | 'explorer' | 'relaxed';
  companion: 'solo' | 'couple' | 'friends' | 'family';
  timeRange: [number, number];
  startLocation: string;
  endLocation: string;
  extraConditions: string;
  ragEnabled: boolean;
  ragMaxPlaces: number;
}

export interface SearchPlaceOption {
  name: string;
  address: string;
}

export interface PlacePost {
  id: string;
  type?: 'visited' | 'want' | string;
  rating?: string | null;
  photos?: string[];
  photo_variants?: {
    thumbnailUrl?: string;
    mediumUrl?: string;
    originalUrl?: string;
  }[];
  memo?: string | null;
  recommended_menu?: string | null;
  profiles?: {
    id?: string | null;
    nickname?: string | null;
    avatar_url?: string | null;
  } | null;
  post_likes?: Array<{ count?: number | string }>;
  post_saves?: Array<{ count?: number | string }>;
  created_at?: string;
}

export interface RecommendSettings {
  startDate: string;
  endDate: string;
  timeRange: [number, number];
  styles: string[];
  companion: 'solo' | 'couple' | 'friends' | 'family';
  extraConditions: string;
}

export interface MapQueryPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  city: string;
  district: string | null;
  place_type: string;
  avg_rating?: number | null;
}

export interface MapQueryPost {
  place_id: string;
  photos?: string[];
  photo_variants?: {
    thumbnailUrl?: string;
    mediumUrl?: string;
    originalUrl?: string;
  }[];
  type?: 'visited' | 'want' | string;
  rating?: string | null;
  profiles?:
    | {
        nationality?: string | null;
        gender?: string | null;
      }
    | {
        nationality?: string | null;
        gender?: string | null;
      }[]
    | null;
  places?: MapQueryPlace | MapQueryPlace[] | null;
}

export interface MapProfileLite {
  nationality?: string | null;
  gender?: string | null;
}

export interface SavedCourseRecord {
  id: string;
  title: string;
  days: number;
  transport: 'walking' | 'transit' | 'driving' | string;
  place_ids: string[] | null;
  course_data: CourseData | null;
}
