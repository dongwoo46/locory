import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NeighborhoodBounds } from '@/lib/utils/districts'

export type NeighborhoodFilter = NeighborhoodBounds & { id: string; label: string }

export const FEED_FILTER_DEFAULT = {
  city: null as string | null,
  district: null as string | null,
  neighborhoods: [] as NeighborhoodFilter[],
  feedTab: 'all' as 'all' | 'following',
  postType: 'all' as 'all' | 'visited' | 'want',
  sortBy: 'latest' as 'latest' | 'likes' | 'saves',
  minRating: null as number | null,
  categories: [] as string[],
  hiddenOnly: false,
  nationalities: [] as string[],
  ageRange: null as string | null,
  genderFilter: null as string | null,
}

type FeedFilterState = typeof FEED_FILTER_DEFAULT & {
  setFilter: (updates: Partial<typeof FEED_FILTER_DEFAULT>) => void
  resetFilter: () => void
}

export const useFeedFilterStore = create<FeedFilterState>()(
  persist(
    (set) => ({
      ...FEED_FILTER_DEFAULT,
      setFilter: (updates) => set(updates),
      resetFilter: () => set(FEED_FILTER_DEFAULT),
    }),
    { name: 'locory-feed-filter' }
  )
)
