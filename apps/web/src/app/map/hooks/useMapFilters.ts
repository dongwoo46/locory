'use client';

import { useState } from 'react';

type Mode = 'all' | 'saved';
type SortBy = 'latest' | 'popular';
type ViewMode = 'all' | 'feed' | 'places';

export function useMapFilters() {
  const [mode, setMode] = useState<Mode>('all');
  const [city, setCity] = useState<string | null>(null);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [nationalities, setNationalities] = useState<Set<string>>(new Set());
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [district, setDistrict] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  function toggleCategory(cat: string) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function selectCity(nextCity: string | null) {
    setCity(nextCity);
    setDistrict(null);
  }

  function toggleNationality(nat: string) {
    setNationalities((prev) => {
      const next = new Set(prev);
      if (next.has(nat)) {
        next.delete(nat);
      } else {
        next.add(nat);
      }
      return next;
    });
  }

  function resetFilters() {
    setCategories(new Set());
    setNationalities(new Set());
    setGenderFilter(null);
    setHiddenOnly(false);
    setViewMode('all');
    setMinRating(null);
    setSortBy('popular');
  }

  const hasActiveFilters =
    categories.size > 0 ||
    nationalities.size > 0 ||
    genderFilter != null ||
    hiddenOnly ||
    viewMode !== 'all' ||
    minRating != null ||
    district != null;

  return {
    mode,
    setMode,
    city,
    setCity,
    categories,
    setCategories,
    nationalities,
    setNationalities,
    genderFilter,
    setGenderFilter,
    hiddenOnly,
    setHiddenOnly,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    district,
    setDistrict,
    minRating,
    setMinRating,
    showFilters,
    setShowFilters,
    toggleCategory,
    selectCity,
    toggleNationality,
    resetFilters,
    hasActiveFilters,
  };
}
