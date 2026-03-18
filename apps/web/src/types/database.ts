export type Nationality = 'KR' | 'JP' | 'US' | 'CN' | 'ES' | 'RU' | 'OTHER'

export type UserRole = 'user' | 'admin'

export type City = 'seoul' | 'busan' | 'jeju' | 'gyeongju' | 'jeonju' | 'gangneung' | 'sokcho' | 'yeosu' | 'incheon'

export type Category =
  | 'cafe'
  | 'restaurant'
  | 'photospot'
  | 'street'
  | 'bar'
  | 'culture'
  | 'nature'
  | 'shopping'

export type PlaceType = 'normal' | 'hidden_spot'

export type PostType = 'visited' | 'want'

export type Rating = 'must_go' | 'worth_it' | 'neutral' | 'not_great'

export type TrustAction =
  | 'visited_post'
  | 'want_post'
  | 'hidden_spot_registered'
  | 'post_saved_by_other'
  | 'place_saved_by_other'
  | 'hidden_spot_reposted'
  | 'daily_bonus'
  | 'reported'
  | 'fake_place'

export interface Profile {
  id: string
  nickname: string
  nationality: Nationality
  avatar_url: string | null
  is_public: boolean
  trust_score: number
  role: UserRole
  created_at: string
}

export interface Place {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  city: City
  category: Category
  place_type: PlaceType
  created_by: string | null
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  place_id: string
  type: PostType
  rating: Rating | null
  memo: string | null
  photos: string[]
  is_public: boolean
  created_at: string
}

export interface PlaceSave {
  id: string
  user_id: string
  place_id: string
  created_at: string
}

export interface PostSave {
  id: string
  user_id: string
  post_id: string
  created_at: string
}

export interface TrustLog {
  id: string
  user_id: string
  action_type: TrustAction
  points: number
  ref_id: string | null
  created_at: string
}

// 냄새 점수 계산 (trust_score → 0~100 표시 점수)
export function calcScentScore(trustScore: number): number {
  if (trustScore <= 0) return 0
  return Math.min(100, Math.round(Math.log(trustScore) / Math.log(2000) * 100))
}

// 냄새 등급
export interface ScentLevel {
  id: string      // 번역 키 (영문)
  color: string
  bg: string
  min: number
  max: number
}

export const SCENT_LEVELS: ScentLevel[] = [
  { id: 'stench',   color: '#8B5A2B', bg: '#F5EDE6', min: 0,  max: 9  },
  { id: 'odorless', color: '#9E9E9E', bg: '#F5F5F5', min: 10, max: 24 },
  { id: 'grass',    color: '#4CAF50', bg: '#E8F5E9', min: 25, max: 39 },
  { id: 'floral',   color: '#E91E8C', bg: '#FCE4EC', min: 40, max: 54 },
  { id: 'woody',    color: '#795548', bg: '#EFEBE9', min: 55, max: 69 },
  { id: 'ocean',    color: '#0288D1', bg: '#E1F5FE', min: 70, max: 84 },
  { id: 'perfume',  color: '#7B1FA2', bg: '#F3E5F5', min: 85, max: 100 },
]

export function getScentLevel(trustScore: number): ScentLevel {
  const score = calcScentScore(trustScore)
  return SCENT_LEVELS.find(l => score >= l.min && score <= l.max) ?? SCENT_LEVELS[0]
}
