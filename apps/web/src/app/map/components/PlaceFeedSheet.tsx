'use client';

import { useCallback, useState } from 'react';
import type { UIEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import ReportSheet from '@/components/ui/ReportSheet';
import { createClient } from '@/lib/supabase/client';
import { getPostImageUrl } from '@/lib/utils/postImage';
import { CATEGORY_COLOR, RATING_COLORS } from '../map.constants';
import type { Place, PlacePost } from '../map.types';

type SheetSort = 'latest' | 'likes' | 'saves';

function toCount(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

interface PlaceFeedSheetProps {
  place: Place | null;
  open: boolean;
  onClose: () => void;
  placePostsLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  sortedPlacePosts: PlacePost[];
  sheetSort: SheetSort;
  setSheetSort: (sort: SheetSort) => void;
}

export default function PlaceFeedSheet({
  place,
  open,
  onClose,
  placePostsLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  sortedPlacePosts,
  sheetSort,
  setSheetSort,
}: PlaceFeedSheetProps) {
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('map');
  const tPost = useTranslations('post');
  const tCities = useTranslations('cities');
  const tDistricts = useTranslations('districts');

  const [showPlaceReport, setShowPlaceReport] = useState(false);
  const [showPlaceMenu, setShowPlaceMenu] = useState(false);
  const [sheetPost, setSheetPost] = useState<PlacePost | null>(null);
  const selectedProfileId = sheetPost?.profiles?.id ?? null;
  const { data: selectedProfile } = useQuery({
    queryKey: ['place-sheet-profile', selectedProfileId],
    enabled: Boolean(selectedProfileId),
    queryFn: async () => {
      if (!selectedProfileId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', selectedProfileId)
        .single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const selectedAvatarUrl =
    selectedProfile?.avatar_url ?? sheetPost?.profiles?.avatar_url ?? null;

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!hasNextPage || isFetchingNextPage) return;
      const target = event.currentTarget;
      const remain = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (remain < 300) onLoadMore();
    },
    [hasNextPage, isFetchingNextPage, onLoadMore],
  );

  if (!open || !place) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-60 flex items-end justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-lg rounded-t-2xl flex flex-col mb-16"
          style={{ maxHeight: 'calc(72vh - 64px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-8 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: (CATEGORY_COLOR[place.category] || '#607D8B') + '20',
                }}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLOR[place.category] || '#607D8B' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{place.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {tPost(`category.${place.category}`)} · {tCities(place.city)}
                  {place.district && place.district !== 'other'
                    ? ` ${tDistricts(`${place.city}.${place.district}`)}`
                    : ''}
                  {place.place_type === 'hidden_spot' && (
                    <span className="ml-1 text-purple-400">{tPost('hiddenSpot')}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {place.google_rating != null && (
                    <span className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                      <span className="text-yellow-400">*</span>
                      {place.google_rating.toFixed(1)}
                      <span className="text-gray-400 font-normal">(Google)</span>
                    </span>
                  )}
                  {place.rating && RATING_COLORS[place.rating] && (
                    <span
                      className="text-white text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: RATING_COLORS[place.rating] }}
                    >
                      {tPost(`rating.${place.rating}`)}
                    </span>
                  )}
                  {(place.category === 'cafe' ||
                    place.category === 'restaurant' ||
                    place.category === 'bar') && (
                    <a
                      href={`https://map.naver.com/v5/search/${encodeURIComponent(place.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"
                    >
                      N {t('naverMenu')}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setShowPlaceMenu((v) => !v)}
                    className="p-1 text-gray-400"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {showPlaceMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowPlaceMenu(false)}
                      />
                      <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[100px]">
                        <button
                          onClick={() => {
                            setShowPlaceMenu(false);
                            setShowPlaceReport(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <svg
                            width="13"
                            height="13"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            viewBox="0 0 24 24"
                            className="rounded border border-red-200 text-red-400 p-0.5 box-content"
                          >
                            <path
                              d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" />
                          </svg>
                          {tPost('report')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => router.push(`/place/${place.id}`)}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-xl font-medium"
                >
                  {t('detail')}
                </button>
              </div>
            </div>
          </div>

          {showPlaceReport && (
            <ReportSheet
              targetType="place"
              targetId={place.id}
              onClose={() => setShowPlaceReport(false)}
            />
          )}

          <div className="overflow-y-auto flex-1 pb-4" onScroll={handleScroll}>
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
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {sortedPlacePosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => setSheetPost(post)}
                    className="aspect-square bg-gray-100 relative overflow-hidden"
                  >
                    {post.photos?.[0] ? (
                      <Image
                        src={getPostImageUrl(post, 0, 'thumbnail')}
                        alt=""
                        className="object-cover"
                        fill
                        sizes="(max-width: 768px) 33vw, 140px"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No image
                      </div>
                    )}
                    {post.type === 'visited' && post.rating && (
                      <div
                        className="absolute top-1 left-1 w-2 h-2 rounded-full border border-white"
                        style={{ backgroundColor: RATING_COLORS[post.rating] }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                {t('loading')}
              </div>
            )}
          </div>
        </div>
      </div>

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
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0">
                {selectedAvatarUrl ? (
                  <Image
                    src={selectedAvatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    width={32}
                    height={32}
                    loading="lazy"
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
            <div className="px-4 pb-2 -mt-1 flex items-center gap-3 text-xs text-gray-500">
              <span>❤️ {toCount(sheetPost.post_likes?.[0]?.count)}</span>
              <span>🔖 {toCount(sheetPost.post_saves?.[0]?.count)}</span>
            </div>
            {sheetPost.photos?.[0] && (
              <div className="relative aspect-square bg-gray-100 overflow-hidden">
                <Image
                  src={getPostImageUrl(sheetPost, 0, 'medium')}
                  alt=""
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 640px"
                  loading="eager"
                  priority
                />
              </div>
            )}
            <div className="px-4 py-3 pb-8 flex flex-col gap-3">
              {sheetPost.recommended_menu && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-50 rounded-xl">
                  <span className="text-base shrink-0">🍽️</span>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-500 mb-0.5">
                      {t('menuLabel')}
                    </p>
                    <p className="text-sm text-gray-800">{sheetPost.recommended_menu}</p>
                  </div>
                </div>
              )}
              {sheetPost.memo && (
                <p className="text-sm text-gray-700 leading-relaxed">{sheetPost.memo}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
