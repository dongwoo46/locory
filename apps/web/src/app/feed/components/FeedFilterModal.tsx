'use client'

type TranslateFn = (key: string) => string

type ViewMode = 'posts' | 'places'
type FeedTab = 'all' | 'following'
type SortBy = 'latest' | 'likes' | 'saves'
type PostType = 'all' | 'visited' | 'want'
type GenderFilter = 'female' | 'male' | null
type AgeRange = '10s' | '20s' | '30s' | '40s+' | null

type Props = {
  open: boolean
  onClose: () => void
  onReset: () => void
  t: TranslateFn
  tPost: TranslateFn
  tProfile: TranslateFn
  viewMode: ViewMode
  setViewMode: (value: ViewMode) => void
  feedTab: FeedTab
  setFeedTab: (value: FeedTab) => void
  sortBy: SortBy
  setSortBy: (value: SortBy) => void
  postType: PostType
  setPostType: (value: PostType) => void
  minRating: number | null
  setMinRating: (value: number | null) => void
  categoryColors: Record<string, string>
  categoriesSet: Set<string>
  toggleCategory: (value: string) => void
  hiddenOnly: boolean
  setHiddenOnly: (value: boolean) => void
  nationalityChips: Array<{ code: string; flag: string }>
  nationalitiesSet: Set<string>
  toggleNationality: (value: string) => void
  genderFilter: GenderFilter
  setGenderFilter: (value: GenderFilter) => void
  ageRange: AgeRange
  setAgeRange: (value: AgeRange) => void
  ratingColors: Record<string, string>
}

export default function FeedFilterModal({
  open,
  onClose,
  onReset,
  t,
  tPost,
  tProfile,
  viewMode,
  setViewMode,
  feedTab,
  setFeedTab,
  sortBy,
  setSortBy,
  postType,
  setPostType,
  minRating,
  setMinRating,
  categoryColors,
  categoriesSet,
  toggleCategory,
  hiddenOnly,
  setHiddenOnly,
  nationalityChips,
  nationalitiesSet,
  toggleNationality,
  genderFilter,
  setGenderFilter,
  ageRange,
  setAgeRange,
  ratingColors,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl flex flex-col"
        style={{ maxHeight: '75vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">{t('filter')}</h2>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onReset}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 border border-gray-200"
            >
              {t('filterReset')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white"
            >
              {t('filterApply')}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterViewMode')}</p>
            <div className="flex gap-2">
              {([
                { key: 'posts', label: t('viewModePost') },
                { key: 'places', label: t('viewModePlace') },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setViewMode(opt.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${viewMode === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterFeed')}</p>
            <div className="flex gap-2">
              {([
                { key: 'all', label: t('all') },
                { key: 'following', label: t('followingTab') },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFeedTab(opt.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${feedTab === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterSort')}</p>
            <div className="flex gap-2">
              {([
                { key: 'latest', label: t('filterSortLatest') },
                { key: 'likes', label: t('filterSortLikes') },
                { key: 'saves', label: t('filterSortSaves') },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${sortBy === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterPostType')}</p>
            <div className="flex gap-2">
              {([
                { key: 'all', label: t('all') },
                { key: 'visited', label: t('filterPostVisited') },
                { key: 'want', label: t('filterPostWant') },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPostType(opt.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${postType === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {postType !== 'want' && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterRatingAbove')}</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setMinRating(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${minRating == null ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {t('all')}
                </button>
                {[
                  { score: 4, key: 'must_go' },
                  { score: 3, key: 'worth_it' },
                  { score: 2, key: 'neutral' },
                ].map((r) => (
                  <button
                    key={r.score}
                    onClick={() => setMinRating(minRating === r.score ? null : r.score)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={minRating === r.score
                      ? { backgroundColor: ratingColors[r.key], color: 'white', borderColor: 'transparent' }
                      : { backgroundColor: 'white', color: '#4B5563', borderColor: '#E5E7EB' }}
                  >
                    {tPost(`rating.${r.key}`)} {t('filterAboveSuffix')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterCategory')}</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(categoryColors).map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${categoriesSet.has(cat) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                  style={categoriesSet.has(cat) ? { backgroundColor: categoryColors[cat] } : {}}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoriesSet.has(cat) ? 'white' : categoryColors[cat] }} />
                  {tPost(`category.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={() => setHiddenOnly(!hiddenOnly)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${hiddenOnly ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {t('filterLocalOnly')}
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterNationality')}</p>
            <div className="flex flex-wrap gap-2">
              {nationalityChips.map(({ code, flag }) => (
                <button
                  key={code}
                  onClick={() => toggleNationality(code)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${nationalitiesSet.has(code) ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {flag} {code}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterGender')}</p>
            <div className="flex gap-2">
              {([null, 'female', 'male'] as const).map((g) => (
                <button
                  key={String(g)}
                  onClick={() => setGenderFilter(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${genderFilter === g ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {g === null ? t('all') : tProfile(`gender.${g}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterAge')}</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: null, label: t('all') },
                { key: '10s', label: t('filterAge10s') },
                { key: '20s', label: t('filterAge20s') },
                { key: '30s', label: t('filterAge30s') },
                { key: '40s+', label: t('filterAge40s') },
              ] as const).map((opt) => (
                <button
                  key={String(opt.key)}
                  onClick={() => setAgeRange(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ageRange === opt.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
