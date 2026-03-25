'use client';

import { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Range, getTrackBackground } from 'react-range';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { CITIES, getDistricts } from '@/lib/utils/districts';
import type { City } from '@/types/database';
import { CATEGORY_EMOJIS } from '../map.constants';
import { slotToTime } from '../map.helpers';
import type { RecommendSettings } from '../map.types';

type RecommendStep = 'neighborhoods' | 'settings' | 'generating' | 'result';

interface RecommendBuildSheetProps {
  open: boolean;
  recommendStep: RecommendStep;
  setRecommendStep: (step: RecommendStep) => void;
  recommendCityTab: City;
  setRecommendCityTab: (city: City) => void;
  recommendDistricts: string[];
  setRecommendDistricts: Dispatch<SetStateAction<string[]>>;
  showFewPlacesWarning: boolean;
  setShowFewPlacesWarning: (value: boolean) => void;
  recommendPlaceCount: number | null;
  checkRecommendPlaceCount: () => void;
  showRecommendCalendar: boolean;
  setShowRecommendCalendar: (value: boolean) => void;
  recommendSettings: RecommendSettings;
  setRecommendSettings: Dispatch<SetStateAction<RecommendSettings>>;
  handleRecommendCourse: () => void;
  onClose: () => void;
}

export default function RecommendBuildSheet({
  open,
  recommendStep,
  setRecommendStep,
  recommendCityTab,
  setRecommendCityTab,
  recommendDistricts,
  setRecommendDistricts,
  showFewPlacesWarning,
  setShowFewPlacesWarning,
  recommendPlaceCount,
  checkRecommendPlaceCount,
  showRecommendCalendar,
  setShowRecommendCalendar,
  recommendSettings,
  setRecommendSettings,
  handleRecommendCourse,
  onClose,
}: RecommendBuildSheetProps) {
  const t = useTranslations('map');
  const tPost = useTranslations('post');

  if (!open) return null;

  return (
    <>
      {recommendStep !== 'generating' && (
        <div className="fixed inset-x-0 bottom-16 z-40 pointer-events-auto">
          <div className="bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {recommendStep === 'settings' && (
                  <button onClick={() => setRecommendStep('neighborhoods')} className="p-1 -ml-1">
                    <svg width="18" height="18" fill="none" stroke="#374151" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M15 19l-7-7 7-7" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <h2 className="text-base font-bold text-gray-900">
                  {recommendStep === 'neighborhoods'
                    ? t('recommend.neighborhoodsTitle')
                    : t('recommend.settingsTitle')}
                </h2>
              </div>
              <button
                onClick={() => {
                  onClose();
                  setRecommendStep('neighborhoods');
                }}
                className="p-1.5 rounded-full bg-gray-100"
              >
                <svg width="14" height="14" fill="none" stroke="#6B7280" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-6 pt-3">
              {recommendStep === 'neighborhoods' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-500">{t('recommend.neighborhoodsSubtitle')}</p>

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CITIES.map((city) => (
                      <button
                        key={city.value}
                        onClick={() => setRecommendCityTab(city.value as City)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${recommendCityTab === city.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {city.label}
                      </button>
                    ))}
                  </div>

                  {recommendDistricts.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {recommendDistricts.map((d) => (
                        <span key={d} className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-full">
                          {d}
                          <button onClick={() => setRecommendDistricts((prev) => prev.filter((x) => x !== d))}>
                            <svg width="10" height="10" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {getDistricts(recommendCityTab).map((d: { value: string; label: string }) => {
                      const selected = recommendDistricts.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          onClick={() =>
                            setRecommendDistricts((prev) =>
                              selected ? prev.filter((x) => x !== d.value) : [...prev, d.value],
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>

                  {showFewPlacesWarning && recommendPlaceCount !== null && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3">
                      <p className="text-sm text-amber-800">
                        {t('recommend.fewPlacesWarning', { n: recommendPlaceCount })}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowFewPlacesWarning(false);
                            setRecommendStep('settings');
                          }}
                          className="flex-1 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl"
                        >
                          {t('recommend.fewPlacesContinue')}
                        </button>
                        <button
                          onClick={() => {
                            onClose();
                            setShowFewPlacesWarning(false);
                          }}
                          className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-xl"
                        >
                          {t('recommend.fewPlacesAdd')}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={checkRecommendPlaceCount}
                    disabled={recommendDistricts.length === 0}
                    className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
                  >
                    {t('recommend.next')}
                  </button>
                </div>
              )}

              {recommendStep === 'settings' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      {t('course.startDate')} ~ {t('course.endDate')}
                    </p>
                    <button
                      onClick={() => setShowRecommendCalendar(!showRecommendCalendar)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-left flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-900">
                        {recommendSettings.startDate} ~ {recommendSettings.endDate}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.max(
                          1,
                          Math.round(
                            (new Date(recommendSettings.endDate).getTime() -
                              new Date(recommendSettings.startDate).getTime()) /
                              (1000 * 60 * 60 * 24),
                          ) + 1,
                        )}
                        ??
                      </span>
                    </button>
                    {showRecommendCalendar && (
                      <div className="mt-2 flex justify-center border border-gray-100 rounded-xl p-2 bg-white">
                        <DayPicker
                          mode="range"
                          selected={{
                            from: new Date(recommendSettings.startDate),
                            to: new Date(recommendSettings.endDate),
                          }}
                          onSelect={(range: DateRange | undefined) => {
                            if (range?.from) {
                              const from = range.from.toISOString().slice(0, 10);
                              const to = (range.to ?? range.from).toISOString().slice(0, 10);
                              setRecommendSettings((s) => ({
                                ...s,
                                startDate: from,
                                endDate: to,
                              }));
                              if (range.to) setShowRecommendCalendar(false);
                            }
                          }}
                          disabled={{ before: new Date() }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t('course.timeRange')}</p>
                    <div className="flex items-center justify-between text-xs font-medium text-gray-900 mb-2">
                      <span>{slotToTime(recommendSettings.timeRange[0])}</span>
                      <span>{slotToTime(recommendSettings.timeRange[1])}</span>
                    </div>
                    <div className="px-2">
                      <Range
                        step={1}
                        min={0}
                        max={40}
                        values={recommendSettings.timeRange}
                        onChange={(vals) => setRecommendSettings((s) => ({ ...s, timeRange: vals as [number, number] }))}
                        renderTrack={({ props, children }) => (
                          <div
                            {...props}
                            style={{
                              ...props.style,
                              height: '4px',
                              borderRadius: '2px',
                              background: getTrackBackground({
                                values: recommendSettings.timeRange,
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
                                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                              }}
                            />
                          );
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{t('recommend.styles')}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(['cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping'] as const).map((cat) => {
                        const selected = recommendSettings.styles.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() =>
                              setRecommendSettings((s) => ({
                                ...s,
                                styles: selected ? s.styles.filter((x) => x !== cat) : [...s.styles, cat],
                              }))
                            }
                            className={`py-2 rounded-xl text-xs font-medium transition-colors ${selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {CATEGORY_EMOJIS[cat]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(['cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping'] as const).map((cat) =>
                        recommendSettings.styles.includes(cat) ? (
                          <span key={cat} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                            {tPost(`category.${cat}`)}
                          </span>
                        ) : null,
                      )}
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
                          onClick={() => setRecommendSettings((s) => ({ ...s, companion: opt.value }))}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${recommendSettings.companion === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t('course.extraConditions')}</p>
                    <p className="text-[10px] text-gray-400 mb-1">{t('course.extraConditionsHint')}</p>
                    <textarea
                      value={recommendSettings.extraConditions}
                      onChange={(e) => setRecommendSettings((s) => ({ ...s, extraConditions: e.target.value }))}
                      placeholder={t('course.extraConditionsPlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleRecommendCourse}
                    className="w-full py-3.5 bg-purple-600 text-white rounded-xl text-sm font-semibold"
                  >
                    {t('recommend.generateBtn')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {recommendStep === 'generating' && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-white/90 pointer-events-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-gray-900">{t('recommend.generatingTitle')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('recommend.analyzingData')}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
