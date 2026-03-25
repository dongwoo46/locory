'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PlacePost } from '../map.types';

type SheetSort = 'latest' | 'likes' | 'saves';

interface UsePlacePostsSheetParams {
  selectedPlaceId: string | null;
  fetchPostsByPlace: (
    placeId: string,
    offset: number,
    limit: number,
  ) => Promise<PlacePost[]>;
}

const PAGE_SIZE = 15;

function toNumericCount(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function usePlacePostsSheet({
  selectedPlaceId,
  fetchPostsByPlace,
}: UsePlacePostsSheetParams) {
  const [sheetSort, setSheetSort] = useState<SheetSort>('latest');

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['place-sheet-posts', selectedPlaceId],
    enabled: Boolean(selectedPlaceId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!selectedPlaceId) return [];
      return fetchPostsByPlace(selectedPlaceId, pageParam, PAGE_SIZE);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const placePosts = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data],
  );

  const sortedPlacePosts = useMemo(() => {
    return [...placePosts].sort((a, b) => {
      if (sheetSort === 'likes') {
        return (
          toNumericCount(b.post_likes?.[0]?.count) -
          toNumericCount(a.post_likes?.[0]?.count)
        );
      }
      if (sheetSort === 'saves') {
        return (
          toNumericCount(b.post_saves?.[0]?.count) -
          toNumericCount(a.post_saves?.[0]?.count)
        );
      }
      return (
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
      );
    });
  }, [placePosts, sheetSort]);

  return {
    placePostsLoading: isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadMorePosts: () => {
      if (!hasNextPage || isFetchingNextPage) return;
      void fetchNextPage();
    },
    sortedPlacePosts,
    sheetSort,
    setSheetSort,
  };
}
