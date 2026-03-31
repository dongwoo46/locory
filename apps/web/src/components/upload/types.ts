import type { Category, City, PlaceType, PostType, Rating } from '@/types/database'

export interface SelectedPlace {
  id?: string // existing place id when already in places table
  name: string
  lat: number
  lng: number
  address: string
  city: City
  countryCode?: string | null
  adminAreaLevel2?: string | null
  category: Category
  place_type: PlaceType
}

export interface UploadState {
  step: 1 | 2 | 3 | 4 | 5
  place: SelectedPlace | null
  postType: PostType | null
  photos: File[]
  rating: Rating | null
  memo: string
  recommendedMenu: string
  isPublic: boolean
  isLocalRecommendation: boolean
}

export const INITIAL_STATE: UploadState = {
  step: 1,
  place: null,
  postType: null,
  photos: [],
  rating: null,
  memo: '',
  recommendedMenu: '',
  isPublic: true,
  isLocalRecommendation: false,
}
