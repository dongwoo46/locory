import type { Category, City, PlaceType, PostType, Rating } from '@/types/database'

export interface SelectedPlace {
  id?: string          // 기존 places 테이블에 있는 경우
  name: string
  lat: number
  lng: number
  address: string
  city: City
  district: string
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
}
