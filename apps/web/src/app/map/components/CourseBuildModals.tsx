'use client';

import { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Range, getTrackBackground } from 'react-range';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import type { CourseSettings, Place, SearchPlaceOption } from '../map.types';
import { slotToTime } from '../map.helpers';

type BuildStep = 'select' | 'settings' | 'generating' | 'result';
type Accommodation = { name: string; address: string } | null;

interface CourseBuildModalsProps {
  mapMode: 'normal' | 'course-build' | 'course-view' | 'recommend-build';
  buildStep: BuildStep;
  setBuildStep: (step: BuildStep) => void;
  courseSettings: CourseSettings;
  setCourseSettings: Dispatch<SetStateAction<CourseSettings>>;
  showCalendar: boolean;
  setShowCalendar: (value: boolean) => void;
  courseLoading: boolean;
  courseSelection: Place[];
  handleGenerateCourse: () => void;
  savedAccommodation: Accommodation;
  clearSavedAccommodation: () => void;
  accomQuery: string;
  setAccomQuery: (value: string) => void;
  accomResults: SearchPlaceOption[];
  setAccomResults: Dispatch<SetStateAction<SearchPlaceOption[]>>;
  accomSearching: boolean;
  searchAccomPlaces: (q: string) => void;
  saveAccommodation: (name: string, address: string) => void;
  startLocQuery: string;
  setStartLocQuery: (value: string) => void;
  startLocResults: SearchPlaceOption[];
  setStartLocResults: Dispatch<SetStateAction<SearchPlaceOption[]>>;
  startLocSearching: boolean;
  setStartLocSearching: (value: boolean) => void;
  endLocQuery: string;
  setEndLocQuery: (value: string) => void;
  endLocResults: SearchPlaceOption[];
  setEndLocResults: Dispatch<SetStateAction<SearchPlaceOption[]>>;
  endLocSearching: boolean;
  setEndLocSearching: (value: boolean) => void;
  searchLocation: (
    query: string,
    setResults: Dispatch<SetStateAction<SearchPlaceOption[]>>,
    setLoading: (value: boolean) => void,
  ) => void;
}

export default function CourseBuildModals({
  mapMode,
  buildStep,
  setBuildStep,
  courseSettings,
  setCourseSettings,
  showCalendar,
  setShowCalendar,
  courseLoading,
  courseSelection,
  handleGenerateCourse,
  savedAccommodation,
  clearSavedAccommodation,
  accomQuery,
  setAccomQuery,
  accomResults,
  setAccomResults,
  accomSearching,
  searchAccomPlaces,
  saveAccommodation,
  startLocQuery,
  setStartLocQuery,
  startLocResults,
  setStartLocResults,
  startLocSearching,
  setStartLocSearching,
  endLocQuery,
  setEndLocQuery,
  endLocResults,
  setEndLocResults,
  endLocSearching,
  setEndLocSearching,
  searchLocation,
}: CourseBuildModalsProps) {
  const t = useTranslations('map');

  return (
    <>
      {mapMode === 'course-build' && buildStep === 'settings' && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 lg:p-0"
          onClick={() => setBuildStep('select')}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl max-h-[85vh] shadow-[0_4px_24px_rgba(0,0,0,0.15)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900">{t('course.travelConditions')}</h2>
              <button onClick={() => setBuildStep('select')} className="text-gray-400 p-1 -mr-1">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 pb-6 pt-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.startDate')} ~ {t('course.endDate')}</p>
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-left flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900">{courseSettings.startDate} ~ {courseSettings.endDate}</span>
                  <span className="text-xs text-gray-400">
                    {Math.max(
                      1,
                      Math.round(
                        (new Date(courseSettings.endDate).getTime() - new Date(courseSettings.startDate).getTime()) /
                          (1000 * 60 * 60 * 24),
                      ) + 1,
                    )}
                    ??
                  </span>
                </button>
                {showCalendar && (
                  <div className="mt-2 flex justify-center border border-gray-100 rounded-xl p-2 bg-white">
                    <DayPicker
                      mode="range"
                      selected={{
                        from: new Date(courseSettings.startDate),
                        to: new Date(courseSettings.endDate),
                      }}
                      onSelect={(range: DateRange | undefined) => {
                        if (range?.from) {
                          const from = range.from.toISOString().slice(0, 10);
                          const to = (range.to ?? range.from).toISOString().slice(0, 10);
                          setCourseSettings((s) => ({ ...s, startDate: from, endDate: to }));
                          if (range.to) setShowCalendar(false);
                        }
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">{t('course.startDateHint')}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.transport')}</p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: 'transit', label: t('course.transportTransit') },
                      { value: 'walking', label: t('course.transportWalking') },
                      { value: 'driving', label: t('course.transportDriving') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCourseSettings((s) => ({ ...s, transport: opt.value }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${courseSettings.transport === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.vibe')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: 'relaxed', label: t('course.vibeRelaxed') },
                      { value: 'recording', label: t('course.vibeRecording') },
                      { value: 'foodie', label: t('course.vibeFoodie') },
                      { value: 'explorer', label: t('course.vibeExplorer') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCourseSettings((s) => ({ ...s, vibe: opt.value }))}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors ${courseSettings.vibe === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.companion')}</p>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { value: 'solo', label: t('course.companionSolo') },
                      { value: 'couple', label: t('course.companionCouple') },
                      { value: 'friends', label: t('course.companionFriends') },
                      { value: 'family', label: t('course.companionFamily') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCourseSettings((s) => ({ ...s, companion: opt.value }))}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${courseSettings.companion === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">{t('course.timeRange')}</p>
                <p className="text-[10px] text-gray-400 mb-3">{t('course.timeRangeHint')}</p>
                <div className="flex items-center justify-between text-xs font-medium text-gray-900 mb-2">
                  <span>{slotToTime(courseSettings.timeRange[0])}</span>
                  <span>{slotToTime(courseSettings.timeRange[1])}</span>
                </div>
                <div className="px-2">
                  <Range
                    step={1}
                    min={0}
                    max={40}
                    values={courseSettings.timeRange}
                    onChange={(vals) => setCourseSettings((s) => ({ ...s, timeRange: vals as [number, number] }))}
                    renderTrack={({ props, children }) => (
                      <div
                        {...props}
                        style={{
                          ...props.style,
                          height: '4px',
                          borderRadius: '2px',
                          background: getTrackBackground({
                            values: courseSettings.timeRange,
                            colors: ['#e5e7eb', '#111827', '#e5e7eb'],
                            min: 0,
                            max: 40,
                          }),
                        }}
                      >
                        {children}
                      </div>
                    )}
                    renderThumb={({ props }) => {
                      const { key, ...restProps } = props;
                      return (
                        <div
                          key={key}
                          {...restProps}
                          style={{
                            ...restProps.style,
                            height: '24px',
                            width: '24px',
                            backgroundColor: '#111827',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          }}
                        />
                      );
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.accommodation')}</p>
                {savedAccommodation && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 rounded-xl mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{savedAccommodation.name}</p>
                      {savedAccommodation.address && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{savedAccommodation.address}</p>
                      )}
                    </div>
                    <button onClick={clearSavedAccommodation} className="shrink-0 p-1 text-gray-400">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={accomQuery}
                    onChange={(e) => {
                      setAccomQuery(e.target.value);
                      if (!e.target.value) setAccomResults([]);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && searchAccomPlaces(accomQuery)}
                    placeholder={t('course.accomPlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={() => searchAccomPlaces(accomQuery)}
                    disabled={accomSearching || !accomQuery.trim()}
                    className="shrink-0 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium disabled:opacity-40"
                  >
                    {accomSearching ? '...' : t('course.search')}
                  </button>
                </div>
                {accomResults.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1 border border-gray-100 rounded-xl overflow-hidden">
                    {accomResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => saveAccommodation(r.name, r.address)}
                        className="text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{r.address}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.startLocation')}</p>
                {savedAccommodation ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={courseSettings.startLocation}
                      onChange={(e) => setCourseSettings((s) => ({ ...s, startLocation: e.target.value }))}
                      placeholder={t('course.startLocationPlaceholder')}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                    />
                    <button
                      onClick={() => setCourseSettings((s) => ({ ...s, startLocation: savedAccommodation.name }))}
                      className="shrink-0 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium whitespace-nowrap"
                    >
                      {t('course.useAccom')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={startLocQuery || courseSettings.startLocation}
                        onChange={(e) => {
                          setStartLocQuery(e.target.value);
                          setCourseSettings((s) => ({ ...s, startLocation: e.target.value }));
                          if (!e.target.value) setStartLocResults([]);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && searchLocation(startLocQuery, setStartLocResults, setStartLocSearching)}
                        placeholder={t('course.startLocationPlaceholder')}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                      />
                      <button
                        onClick={() => searchLocation(startLocQuery, setStartLocResults, setStartLocSearching)}
                        disabled={startLocSearching || !startLocQuery.trim()}
                        className="shrink-0 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium disabled:opacity-40"
                      >
                        {startLocSearching ? '...' : t('course.search')}
                      </button>
                    </div>
                    {startLocResults.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0 border border-gray-100 rounded-xl overflow-hidden">
                        {startLocResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setCourseSettings((s) => ({ ...s, startLocation: r.name }));
                              setStartLocQuery(r.name);
                              setStartLocResults([]);
                            }}
                            className="text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.address}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('course.endLocation')}</p>
                {savedAccommodation ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={courseSettings.endLocation}
                      onChange={(e) => setCourseSettings((s) => ({ ...s, endLocation: e.target.value }))}
                      placeholder={t('course.endLocationPlaceholder')}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                    />
                    <button
                      onClick={() => setCourseSettings((s) => ({ ...s, endLocation: savedAccommodation.name }))}
                      className="shrink-0 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium whitespace-nowrap"
                    >
                      {t('course.useAccom')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={endLocQuery || courseSettings.endLocation}
                        onChange={(e) => {
                          setEndLocQuery(e.target.value);
                          setCourseSettings((s) => ({ ...s, endLocation: e.target.value }));
                          if (!e.target.value) setEndLocResults([]);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && searchLocation(endLocQuery, setEndLocResults, setEndLocSearching)}
                        placeholder={t('course.endLocationPlaceholder')}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                      />
                      <button
                        onClick={() => searchLocation(endLocQuery, setEndLocResults, setEndLocSearching)}
                        disabled={endLocSearching || !endLocQuery.trim()}
                        className="shrink-0 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium disabled:opacity-40"
                      >
                        {endLocSearching ? '...' : t('course.search')}
                      </button>
                    </div>
                    {endLocResults.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0 border border-gray-100 rounded-xl overflow-hidden">
                        {endLocResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setCourseSettings((s) => ({ ...s, endLocation: r.name }));
                              setEndLocQuery(r.name);
                              setEndLocResults([]);
                            }}
                            className="text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.address}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => setCourseSettings((s) => ({ ...s, ragEnabled: !s.ragEnabled }))}
                  className={`w-full flex items-start justify-between px-4 py-3 rounded-xl border transition-colors ${courseSettings.ragEnabled ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium text-gray-900">{t('course.ragToggle')}</span>
                    <span className="text-xs text-gray-400 text-left">{t('course.ragToggleDesc')}</span>
                  </div>
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${courseSettings.ragEnabled ? 'border-gray-900 bg-gray-900' : 'border-gray-300'}`}
                  />
                </button>
                {courseSettings.ragEnabled && (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-gray-500">{t('course.ragMaxPlaces')}</p>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setCourseSettings((s) => ({ ...s, ragMaxPlaces: n }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${courseSettings.ragMaxPlaces === n ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {n === 0 ? t('course.ragMaxAuto') : t('course.ragMaxCount', { n })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">{t('course.extraConditions')}</p>
                <p className="text-[10px] text-gray-400 mb-2">{t('course.extraConditionsHint')}</p>
                <textarea
                  value={courseSettings.extraConditions}
                  onChange={(e) => setCourseSettings((s) => ({ ...s, extraConditions: e.target.value }))}
                  placeholder={t('course.extraConditionsPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
                />
              </div>

              <button
                onClick={handleGenerateCourse}
                disabled={courseLoading}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                {courseLoading ? t('course.generating') : t('course.generateBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {mapMode === 'course-build' && buildStep === 'generating' && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-8 flex flex-col items-center gap-4 max-w-xs mx-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="animate-spin" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{t('course.generatingTitle')}</p>
              <p className="text-xs text-gray-400 mt-1">
                {t('course.analyzingPlaces', { count: courseSelection.length })}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
