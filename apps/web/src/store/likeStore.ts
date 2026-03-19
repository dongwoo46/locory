import { create } from 'zustand'

interface LikeStore {
  // 포스트 좋아요
  likedPostIds: Set<string>
  likeCountMap: Record<string, number>
  // 장소 좋아요
  likedPlaceIds: Set<string>
  // 포스트 저장
  savedPostIds: Set<string>
  // 장소 저장
  savedPlaceIds: Set<string>

  // 초기화 (서버에서 받은 데이터로)
  init: (data: {
    likedPostIds: Set<string>
    likedPlaceIds: Set<string>
    savedPostIds: Set<string>
    savedPlaceIds: Set<string>
    likeCountMap: Record<string, number>
  }) => void

  // 포스트 좋아요 토글
  togglePostLike: (postId: string) => void
  // 장소 좋아요 토글
  togglePlaceLike: (placeId: string) => void
  // 포스트 저장 토글
  togglePostSave: (postId: string) => void
  // 장소 저장 토글
  togglePlaceSave: (placeId: string) => void
  // 포스트 좋아요 수 추가 (새 포스트 로드 시)
  mergePostCounts: (entries: Record<string, number>) => void
}

export const useLikeStore = create<LikeStore>((set) => ({
  likedPostIds: new Set(),
  likeCountMap: {},
  likedPlaceIds: new Set(),
  savedPostIds: new Set(),
  savedPlaceIds: new Set(),

  init: (data) => set({
    likedPostIds: data.likedPostIds,
    likedPlaceIds: data.likedPlaceIds,
    savedPostIds: data.savedPostIds,
    savedPlaceIds: data.savedPlaceIds,
    likeCountMap: data.likeCountMap,
  }),

  togglePostLike: (postId) => set((s) => {
    const liked = s.likedPostIds.has(postId)
    const next = new Set(s.likedPostIds)
    if (liked) next.delete(postId)
    else next.add(postId)
    return {
      likedPostIds: next,
      likeCountMap: {
        ...s.likeCountMap,
        [postId]: Math.max(0, (s.likeCountMap[postId] || 0) + (liked ? -1 : 1)),
      },
    }
  }),

  togglePlaceLike: (placeId) => set((s) => {
    const liked = s.likedPlaceIds.has(placeId)
    const next = new Set(s.likedPlaceIds)
    if (liked) next.delete(placeId)
    else next.add(placeId)
    return { likedPlaceIds: next }
  }),

  togglePostSave: (postId) => set((s) => {
    const saved = s.savedPostIds.has(postId)
    const next = new Set(s.savedPostIds)
    if (saved) next.delete(postId)
    else next.add(postId)
    return { savedPostIds: next }
  }),

  togglePlaceSave: (placeId) => set((s) => {
    const saved = s.savedPlaceIds.has(placeId)
    const next = new Set(s.savedPlaceIds)
    if (saved) next.delete(placeId)
    else next.add(placeId)
    return { savedPlaceIds: next }
  }),

  mergePostCounts: (entries) => set((s) => {
    const hasNew = Object.keys(entries).some(id => !(id in s.likeCountMap))
    if (!hasNew) return s
    return { likeCountMap: { ...entries, ...s.likeCountMap } }
  }),
}))
