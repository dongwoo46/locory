import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useLikeStore } from '@/store/likeStore'

export interface UserInteractions {
  savedPostIds: Set<string>
  savedPlaceIds: Set<string>
  likedPostIds: Set<string>
  likedPlaceIds: Set<string>
}

interface UserInteractionsRpcResult {
  savedPostIds?: string[]
  savedPlaceIds?: string[]
  likedPostIds?: string[]
  likedPlaceIds?: string[]
}

/**
 * 유저 인터랙션 데이터를 RPC 1번으로 조회 (post_saves + place_saves + post_likes + place_likes)
 * 모든 페이지에서 공유 — queryKey: ['user-saved', userId]
 */
export function useUserInteractions(userId: string | null | undefined) {
  const supabase = createClient()
  const { init: initLikeStore } = useLikeStore()

  const query = useQuery<UserInteractions>({
    queryKey: ['user-saved', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return {
          savedPostIds: new Set<string>(),
          savedPlaceIds: new Set<string>(),
          likedPostIds: new Set<string>(),
          likedPlaceIds: new Set<string>(),
        }
      }
      const { data, error } = await supabase.rpc('get_user_interactions', { p_user_id: userId })
      if (error) throw error
      const raw = data as UserInteractionsRpcResult
      return {
        savedPostIds:  new Set<string>(raw.savedPostIds  ?? []),
        savedPlaceIds: new Set<string>(raw.savedPlaceIds ?? []),
        likedPostIds:  new Set<string>(raw.likedPostIds  ?? []),
        likedPlaceIds: new Set<string>(raw.likedPlaceIds ?? []),
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Zustand store 초기화
  useEffect(() => {
    if (!query.data) return
    initLikeStore({
      likedPostIds: query.data.likedPostIds,
      likedPlaceIds: query.data.likedPlaceIds,
      savedPostIds: query.data.savedPostIds,
      savedPlaceIds: query.data.savedPlaceIds,
      likeCountMap: {},
    })
  }, [query.data, initLikeStore])

  return query
}
