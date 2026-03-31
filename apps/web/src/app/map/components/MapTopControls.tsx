'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { Place } from '../map.types';

interface MapTopControlsProps {
  mapMode: 'normal' | 'course-build' | 'course-view' | 'recommend-build';
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSearchSubmit: () => void;
  showSearchDropdown: boolean;
  setShowSearchDropdown: (value: boolean) => void;
  searchResults: Place[];
  onSearchSelect: (place: Place) => void;
  categoryEmojis: Record<string, string>;
  hasActiveFilters: boolean;
  onToggleFilters: () => void;
  mode: 'all' | 'saved';
  setMode: (mode: 'all' | 'saved') => void;
  canUseSavedMode: boolean;
  showRecommendNeighborhoods: boolean;
  onToggleRecommendNeighborhoods: () => void;
  onOpenSavedCourses: () => void;
  onOpenCourseTypePicker: () => void;
}

export default function MapTopControls({
  mapMode,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  showSearchDropdown,
  setShowSearchDropdown,
  searchResults,
  onSearchSelect,
  categoryEmojis,
  hasActiveFilters,
  onToggleFilters,
  mode,
  setMode,
  canUseSavedMode,
  showRecommendNeighborhoods,
  onToggleRecommendNeighborhoods,
  onOpenSavedCourses,
  onOpenCourseTypePicker,
}: MapTopControlsProps) {
  const locale = useLocale();
  const t = useTranslations('map');
  const tCities = useTranslations('cities');
  const funSpotsLabel =
    locale === 'ko' ? '\uB180\uB9CC\uD55C \uACF3' : t('recommend.pickFeature2');

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="max-w-lg mx-auto px-3 pt-3 flex flex-col gap-2">
        {(mapMode === 'normal' || mapMode === 'course-build') && (
          <div className="relative pointer-events-auto">
            <div className="flex items-center bg-white rounded-full shadow px-3 py-2 gap-2">
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="#9CA3AF"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <path
                  d="M21 21l-4.35-4.35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearchSubmit();
                  }
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
                placeholder={t('searchPlaceholder')}
                className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="text-gray-400"
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                {searchResults.map((place) => (
                  <button
                    key={place.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSearchSelect(place)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                  >
                    <span className="text-base shrink-0">
                      {categoryEmojis[place.category] ?? 'S'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {place.name}
                      </p>
                      {place.city && (
                        <p className="text-xs text-gray-400 truncate">
                          {tCities(place.city)}
                          {place.district && place.district !== 'other'
                            ? ' - ' + place.district
                            : ''}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mapMode === 'course-build' && (
          <div className="flex justify-end pointer-events-auto">
            <button
              onClick={onToggleFilters}
              className={`bg-white rounded-full shadow p-2 ${hasActiveFilters ? 'ring-2 ring-gray-900' : ''}`}
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
        )}

        {mapMode === 'normal' && (
          <div className="flex gap-2 pointer-events-auto">
            <div className="bg-white rounded-full shadow flex p-1 gap-0.5">
              {(['all', 'saved'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    if (m === 'saved' && !canUseSavedMode) return;
                    setMode(m);
                  }}
                  disabled={m === 'saved' && !canUseSavedMode}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === m ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                >
                  {t(m)}
                </button>
              ))}
              <button
                onClick={onToggleRecommendNeighborhoods}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  showRecommendNeighborhoods
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500'
                }`}
              >
                {funSpotsLabel}
              </button>
            </div>
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={onOpenSavedCourses}
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
                onClick={onOpenCourseTypePicker}
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
                <span className="text-xs font-medium text-white">
                  {t('course.label')}
                </span>
              </button>
              <button
                onClick={onToggleFilters}
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

      </div>
    </div>
  );
}


