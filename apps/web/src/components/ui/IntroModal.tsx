'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const SEEN_KEY = 'locory_intro_seen_v1';
const HIDE_UNTIL_KEY = 'locory_intro_hide_until_v1';

function addDays(from: Date, days: number) {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export default function IntroModal() {
  const t = useTranslations('intro');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const now = new Date();
    const hideUntilRaw = window.localStorage.getItem(HIDE_UNTIL_KEY);
    if (hideUntilRaw) {
      const hideUntil = new Date(hideUntilRaw);
      if (!Number.isNaN(hideUntil.getTime()) && now < hideUntil) {
        return;
      }
    }

    const seen = window.localStorage.getItem(SEEN_KEY) === '1';
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const points = useMemo(
    () => [t('point1'), t('point2'), t('point3')],
    [t]
  );

  if (!open) return null;

  const handleClose = () => {
    window.localStorage.setItem(SEEN_KEY, '1');
    setOpen(false);
  };

  const handleDontShowToday = () => {
    const hideUntil = addDays(new Date(), 7);
    window.localStorage.setItem(HIDE_UNTIL_KEY, hideUntil.toISOString());
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-modal-title"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 text-sm text-gray-400"
          aria-label={t('close')}
        >
          {t('close')}
        </button>
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 id="intro-modal-title" className="text-xl font-semibold text-gray-900">
              {t('title')}
            </h2>
            <p className="text-sm text-gray-600">{t('subtitle')}</p>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            {points.map((point, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-900" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {t('browserNote')}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-medium text-white"
            >
              {t('cta')}
            </button>
            <button
              type="button"
              onClick={handleDontShowToday}
              className="w-full rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600"
            >
              {t('dontShowToday')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
