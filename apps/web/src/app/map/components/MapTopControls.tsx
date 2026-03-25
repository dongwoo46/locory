'use client';

import type { MouseEventHandler, RefObject } from 'react';
import { useTranslations } from 'next-intl';
import type { City } from '@/types/database';
import type { Place } from '../map.types';

type DistrictItem = { value: string; label: string };

interface MapTopControlsProps {
  mapMode: 'normal' | 'course-build' | 'course-view' | 'recommend-build';
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  showSearchDropdown: boolean;
  setShowSearchDropdown: (value: boolean) => void;
  searchResults: Place[];
  onSearchSelect: (place: Place) => void;
  categoryEmojis: Record<string, string>;
  hasActiveFilters: boolean;
  onToggleFilters: () => void;
  mode: 'all' | 'saved';
  setMode: (mode: 'all' | 'saved') => void;
  onOpenSavedCourses: () => void;
  onOpenCourseTypePicker: () => void;
  cityScrollRef: RefObject<HTMLDivElement | null>;
  onCityMouseDown: MouseEventHandler<HTMLDivElement>;
  onCityMouseMove: MouseEventHandler<HTMLDivElement>;
  onCityMouseUp: MouseEventHandler<HTMLDivElement>;
  onCityMouseLeave: MouseEventHandler<HTMLDivElement>;
  city: string | null;
  selectCity: (city: string | null) => void;
  cities: { value: City; label: string }[];
  districtList: DistrictItem[];
  district: string | null;
  setDistrict: (district: string | null) => void;
}

export default function MapTopControls({
  mapMode,
  searchQuery,
  setSearchQuery,
  showSearchDropdown,
  setShowSearchDropdown,
  searchResults,
  onSearchSelect,
  categoryEmojis,
  hasActiveFilters,
  onToggleFilters,
  mode,
  setMode,
  onOpenSavedCourses,
  onOpenCourseTypePicker,
  cityScrollRef,
  onCityMouseDown,
  onCityMouseMove,
  onCityMouseUp,
  onCityMouseLeave,
  city,
  selectCity,
  cities,
  districtList,
  district,
  setDistrict,
}: MapTopControlsProps) {
  const t = useTranslations('map');
  const tCities = useTranslations('cities');
  if (mapMode === 'course-view') return null;

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
                            ? ` · ${place.district}`
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
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === m ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                >
                  {t(m)}
                </button>
              ))}
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

        <div
          ref={cityScrollRef}
          onMouseDown={onCityMouseDown}
          onMouseMove={onCityMouseMove}
          onMouseUp={onCityMouseUp}
          onMouseLeave={onCityMouseLeave}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pointer-events-auto pb-0.5 cursor-grab select-none"
        >
          <button
            onClick={() => selectCity(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium shadow transition-colors ${!city ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
          >
            {t('all')}
          </button>
          {cities.map((c) => (
            <button
              key={c.value}
              onClick={() => selectCity(city === c.value ? null : c.value)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium shadow transition-colors ${city === c.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
            >
              {tCities(c.value)}
            </button>
          ))}
        </div>

        {city && districtList.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pointer-events-auto pb-0.5 cursor-grab select-none">
            {districtList.map((d) => (
              <button
                key={d.value}
                onClick={() => setDistrict(district === d.value ? null : d.value)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium shadow transition-colors ${district === d.value ? 'bg-gray-700 text-white' : 'bg-white/90 text-gray-600'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
