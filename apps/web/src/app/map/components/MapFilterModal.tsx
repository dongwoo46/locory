'use client';

import { CATEGORY_COLOR, NATIONALITY_CHIPS, RATING_COLORS } from '../map.constants';

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface MapFilterModalProps {
  open: boolean;
  onClose: () => void;
  hasActiveFilters: boolean;
  onReset: () => void;
  t: TranslateFn;
  tPost: TranslateFn;
  viewMode: 'all' | 'feed' | 'places';
  setViewMode: (mode: 'all' | 'feed' | 'places') => void;
  sortBy: 'latest' | 'popular';
  setSortBy: (sort: 'latest' | 'popular') => void;
  minRating: number | null;
  setMinRating: (rating: number | null) => void;
  allCategories: string[];
  categories: Set<string>;
  toggleCategory: (cat: string) => void;
  hiddenOnly: boolean;
  setHiddenOnly: (value: boolean) => void;
  nationalities: Set<string>;
  toggleNationality: (code: string) => void;
  genderFilter: string | null;
  setGenderFilter: (value: string | null) => void;
}

export default function MapFilterModal({
  open,
  onClose,
  hasActiveFilters,
  onReset,
  t,
  tPost,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  minRating,
  setMinRating,
  allCategories,
  categories,
  toggleCategory,
  hiddenOnly,
  setHiddenOnly,
  nationalities,
  toggleNationality,
  genderFilter,
  setGenderFilter,
}: MapFilterModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl p-3 flex flex-col gap-3 overflow-y-auto"
        style={{ maxHeight: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">{t('filter')}</p>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button onClick={onReset} className="text-xs text-gray-400 underline">
                {t('resetFilter')}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-full"
            >
              {t('applyFilter')}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterView')}</p>
          <div className="flex gap-1.5">
            {(['all', 'feed', 'places'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${viewMode === v ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {v === 'all' ? t('viewAll') : v === 'feed' ? t('viewFeed') : t('viewPlaces')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">{t('sort')}</p>
          <div className="flex gap-1.5">
            {(['popular', 'latest'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${sortBy === s ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {t(s)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">{t('avgRating')}</p>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setMinRating(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${minRating == null ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {t('all')}
            </button>
            {[
              { score: 4, label: tPost('rating.must_go'), color: RATING_COLORS.must_go },
              { score: 3, label: tPost('rating.worth_it'), color: RATING_COLORS.worth_it },
              { score: 2, label: tPost('rating.neutral'), color: RATING_COLORS.neutral },
            ].map((r) => (
              <button
                key={r.score}
                onClick={() => setMinRating(minRating === r.score ? null : r.score)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={
                  minRating === r.score
                    ? { backgroundColor: r.color, color: 'white', borderColor: 'transparent' }
                    : { backgroundColor: 'white', color: '#4B5563', borderColor: '#E5E7EB' }
                }
              >
                {r.label} {t('above')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">{t('category')}</p>
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${categories.has(cat) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                style={categories.has(cat) ? { backgroundColor: CATEGORY_COLOR[cat] } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: categories.has(cat) ? 'white' : CATEGORY_COLOR[cat],
                  }}
                />
                {tPost(`category.${cat}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={() => setHiddenOnly(!hiddenOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${hiddenOnly ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            <span>🕳️</span>
            {tPost('hiddenSpotOnly')}
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">{t('nationality')}</p>
          <div className="flex flex-wrap gap-1.5">
            {NATIONALITY_CHIPS.map(({ code, flag }) => (
              <button
                key={code}
                onClick={() => toggleNationality(code)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${nationalities.has(code) ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                <span>{flag}</span>
                <span>{code}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">{t('authorGender')}</p>
          <div className="flex gap-2">
            {(
              [
                { key: null, label: t('genderAll') },
                { key: 'female', label: t('genderFemale') },
                { key: 'male', label: t('genderMale') },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.key)}
                onClick={() => setGenderFilter(opt.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${genderFilter === opt.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
