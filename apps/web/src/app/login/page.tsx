'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

// ─── 브라우저 언어 → 인트로 언어 감지 ─────────────────────────────────────────
function detectBrowserLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ru')) return 'ru';
  return 'en'; // 기본값 영어
}

// locale 쿠키 설정 (next-intl이 읽는 쿠키와 동일)
function setLocaleCookie(locale: string) {
  document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

function getLocaleCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split('; ')
    .find((item) => item.startsWith('locale='))
    ?.split('=')[1];
  return raw ? decodeURIComponent(raw) : null;
}

// 인트로 언어 → next-intl locale 매핑
const LANG_TO_LOCALE: Record<Lang, string> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  ru: 'ru',
};

function localeToLang(locale: string): Lang {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ru')) return 'ru';
  return 'en';
}

function detectInitialLang(): Lang {
  const localeCookie = getLocaleCookie();
  if (localeCookie) return localeToLang(localeCookie);
  return detectBrowserLang();
}

// ─── 인앱 브라우저 감지 ───────────────────────────────────────────────────────
function detectInAppBrowser(): {
  isInApp: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  appName: string;
} {
  if (typeof navigator === 'undefined')
    return { isInApp: false, isAndroid: false, isIOS: false, appName: '' };
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const inAppPatterns: Record<string, RegExp> = {
    KakaoTalk: /KAKAOTALK/i,
    Instagram: /Instagram/i,
    Naver: /NAVER/i,
    Facebook: /FBAN|FBAV|FB_IAB/i,
    Line: /Line\//i,
    Daum: /Daum/i,
    Twitter: /Twitter/i,
    Weibo: /Weibo/i,
    WeChat: /MicroMessenger/i,
    Everytime: /everytime/i,
  };
  for (const [name, pattern] of Object.entries(inAppPatterns)) {
    if (pattern.test(ua))
      return { isInApp: true, isAndroid, isIOS, appName: name };
  }
  if (isAndroid && /wv/.test(ua))
    return { isInApp: true, isAndroid, isIOS, appName: 'In-app browser' };
  if (isIOS && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua))
    return { isInApp: true, isAndroid, isIOS, appName: 'In-app browser' };
  return { isInApp: false, isAndroid, isIOS, appName: '' };
}

// ─── 인트로 콘텐츠 (4개 언어) ────────────────────────────────────────────────
type Lang = 'ko' | 'en' | 'ja' | 'ru';

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
];

const SLIDES: Record<Lang, { icon: string; title: string; desc: string }[]> = {
  ko: [
    {
      icon: '📍',
      title: '숨겨진 장소를 발견하세요',
      desc: '현지인만 아는 카페, 식당, 바, 명소를 탐색해요.\n방문 후기와 평점으로 진짜 맛집을 찾고,\n내 리스트에 저장해 언제든 꺼내보세요.',
    },
    {
      icon: '🌏',
      title: '여행자 피드로 영감을 받아요',
      desc: '전 세계 여행자들이 올린 피드를 둘러보고\n취향 맞는 사람을 팔로우해요.\n국적·성별·나이대별로 필터링해서\n내 스타일의 장소를 찾아보세요.',
    },
    {
      icon: '⚡',
      title: '번개 모임 & AI 동선 짜기',
      desc: '지금 같은 동네에 있는 여행자와\n즉석 번개 모임을 만들어요.\n가고 싶은 장소를 골라 AI가\n최적의 하루 동선을 만들어드려요.',
    },
  ],
  en: [
    {
      icon: '📍',
      title: 'Find Hidden Spots',
      desc: 'Discover local-only cafés, restaurants, bars,\nand landmarks with real reviews and ratings.\nSave your favorites and build your own list.',
    },
    {
      icon: '🌏',
      title: 'Get Inspired by the Feed',
      desc: 'Browse posts from travelers around the world.\nFollow people who match your taste,\nand filter by nationality, gender, or age group.',
    },
    {
      icon: '⚡',
      title: 'Flash Meetups & AI Routes',
      desc: 'Start a flash meetup with travelers\nwho are in the same neighborhood right now.\nOr let AI build the perfect day route\nfrom your saved places.',
    },
  ],
  ja: [
    {
      icon: '📍',
      title: '隠れたスポットを発見',
      desc: 'ローカルだけが知るカフェ・レストラン・バーを\nリアルな口コミと評価で探そう。\nお気に入りをリストに保存していつでも確認。',
    },
    {
      icon: '🌏',
      title: 'フィードでインスピレーションを',
      desc: '世界中の旅行者の投稿をチェックして\n趣味の合う人をフォロー。\n国籍・性別・年代でフィルタリングして\n自分好みの場所を見つけよう。',
    },
    {
      icon: '⚡',
      title: 'フラッシュミートアップ & AIルート',
      desc: '今同じ街にいる旅行者と\n即席ミートアップを開こう。\n行きたい場所を選べばAIが\n最適な1日のルートを作ってくれる。',
    },
  ],
  ru: [
    {
      icon: '📍',
      title: 'Скрытые места Кореи',
      desc: 'Открывайте кафе, рестораны и достопримечательности,\nизвестные только местным.\nСохраняйте избранное в свой список.',
    },
    {
      icon: '🌏',
      title: 'Лента путешественников',
      desc: 'Смотрите посты путешественников со всего мира,\nфолловьте тех, кто вам близок по вкусу.\nФильтруйте по национальности, полу и возрасту.',
    },
    {
      icon: '⚡',
      title: 'Флеш-встречи и AI-маршруты',
      desc: 'Организуйте спонтанную встречу\nс путешественниками в вашем районе.\nИли пусть AI составит идеальный\nмаршрут дня из ваших мест.',
    },
  ],
};

const LOGIN_TEXT: Record<
  Lang,
  { tagline: string; loginBtn: string; anonymousBtn: string; terms: string }
> = {
  ko: {
    tagline: '한국의 숨겨진 장소를\n발견하고 공유하세요',
    loginBtn: 'Google로 시작하기',
    anonymousBtn: '임시로 시작하기',
    terms: '계속하면 서비스 이용약관 및 개인정보처리방침에 동의합니다',
  },
  en: {
    tagline: 'Discover & share\nhidden spots in Korea',
    loginBtn: 'Continue with Google',
    anonymousBtn: 'Try without signing up',
    terms:
      'By continuing, you agree to our Terms of Service and Privacy Policy',
  },
  ja: {
    tagline: '韓国の隠れた場所を\n発見してシェアしよう',
    loginBtn: 'Googleで始める',
    anonymousBtn: 'アカウントなしで始める',
    terms:
      '続けることで、利用規約とプライバシーポリシーに同意したことになります',
  },
  ru: {
    tagline: 'Открывайте скрытые\nместа Кореи',
    loginBtn: 'Войти через Google',
    anonymousBtn: 'Начать без аккаунта',
    terms:
      'Продолжая, вы соглашаетесь с Условиями и Политикой конфиденциальности',
  },
};

const ANONYMOUS_WARNING: Record<Lang, string> = {
  ko: '임시 계정은 기기 변경, 브라우저 데이터 삭제 시 복구가 어려울 수 있어요. 가능하면 계정을 연동해 주세요.',
  en: 'Temporary accounts can be hard to recover after changing devices or clearing browser data. Link an account when possible.',
  ja: '一時アカウントは、端末変更やブラウザデータ削除後の復旧が難しい場合があります。可能ならアカウント連携をおすすめします。',
  ru: 'Временный аккаунт может быть трудно восстановить после смены устройства или очистки данных браузера. По возможности привяжите аккаунт.',
};

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const supabase = createClient();
  const t = useTranslations('login.inAppBrowser');

  const [lang, setLang] = useState<Lang>(() => detectInitialLang());
  const [slide, setSlide] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [animating, setAnimating] = useState(false);

  const inAppInfo =
    typeof navigator !== 'undefined' ? detectInAppBrowser() : null;
  const slides = SLIDES[lang];
  const loginText = LOGIN_TEXT[lang];
  const anonymousWarning = ANONYMOUS_WARNING[lang];
  const totalSlides = slides.length;

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    : `${window.location.origin}/auth/callback`;

  // 인앱 브라우저 감지
  useEffect(() => {
    if (!inAppInfo) return;
    if (inAppInfo.isInApp && inAppInfo.isAndroid) {
      const intentUrl = `intent://${window.location.href.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = intentUrl;
      setTimeout(() => setShowGuide(true), 1500);
    } else if (inAppInfo.isInApp) {
      setShowGuide(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 5초마다 자동 슬라이드
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setSlide((prev) => (prev + 1) % totalSlides);
        setAnimating(false);
      }, 150);
    }, 5000);
    return () => clearInterval(timer);
  }, [totalSlides]);

  function changeLang(l: Lang) {
    setLang(l);
    setLocaleCookie(LANG_TO_LOCALE[l]);
  }

  // First visit: if locale cookie does not exist, use browser language and persist it.
  useEffect(() => {
    if (getLocaleCookie()) return;
    setLocaleCookie(LANG_TO_LOCALE[lang]);
  }, [lang]);

  function goToSlide(idx: number) {
    if (idx === slide) return;
    setAnimating(true);
    setTimeout(() => {
      setSlide(idx);
      setAnimating(false);
    }, 150);
  }

  async function handleGoogleLogin() {
    if (inAppInfo?.isInApp) {
      setShowGuide(true);
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }

  async function handleAnonymousLogin() {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) return;
    // 익명 프로필 초기화
    await fetch('/api/auth/init-anonymous', { method: 'POST' });
    // onboarded 쿠키 설정 (미들웨어가 온보딩 리다이렉트 안 하도록)
    document.cookie = 'onboarded=1; path=/; max-age=31536000; SameSite=Lax';
    window.location.href = '/feed';
  }

  const isIOS = inAppInfo?.isIOS ?? false;
  const appName = inAppInfo?.appName ?? 'In-app browser';
  const currentSlide = slides[slide];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── 언어 탭 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1 pt-safe pt-4 px-4">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => changeLang(l.code)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              lang === l.code
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-between px-8 pb-safe pb-10">
        {/* 로고 */}
        <div className="pt-6">
          <img src="/logo_letter.png" alt="Locory" className="h-20 w-auto" />
        </div>

        {/* 슬라이드 콘텐츠 */}
        <div
          className={`flex flex-col items-center text-center gap-5 transition-opacity duration-150 ${
            animating ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="w-24 h-24 rounded-3xl bg-gray-50 flex items-center justify-center text-5xl shadow-sm">
            {currentSlide.icon}
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-gray-900 leading-snug">
              {currentSlide.title}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">
              {currentSlide.desc}
            </p>
          </div>
        </div>

        {/* 하단 영역 */}
        <div className="w-full flex flex-col items-center gap-5">
          {/* 점 인디케이터 (클릭으로 슬라이드 이동) */}
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === slide ? 'w-6 bg-gray-900' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Google 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            className="flex items-center gap-2.5 px-5 py-2.5 border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <GoogleIcon />
            {loginText.loginBtn}
          </button>

          {/* 임시 시작 버튼 */}
          <button
            onClick={handleAnonymousLogin}
            className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors"
          >
            {loginText.anonymousBtn}
          </button>

          <p className="max-w-xs text-center text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {anonymousWarning}
          </p>

          <p className="text-xs text-gray-400 text-center leading-relaxed px-4">
            {loginText.terms}
          </p>
        </div>
      </div>

      {/* ── 인앱 브라우저 안내 모달 ────────────────────────────────── */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
          <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {t('title', { app: appName })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('subtitle')}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3 text-sm text-gray-700">
                {isIOS ? (
                  <>
                    <Step n={1} text={t('iosStep1')} />
                    <Step n={2} text={t('iosStep2')} />
                    <Step n={3} text={t('iosStep3')} />
                  </>
                ) : (
                  <>
                    <Step n={1} text={t('androidStep1')} />
                    <Step n={2} text={t('androidStep2')} />
                    <Step n={3} text={t('androidStep3')} />
                  </>
                )}
              </div>
            </div>
            <div className="px-6 py-4">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-medium"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
      />
      <path
        fill="#34A853"
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.87v2.07A8 8 0 0 0 8.98 17z"
      />
      <path
        fill="#FBBC05"
        d="M4.51 10.53c-.16-.48-.25-.98-.25-1.53s.09-1.05.25-1.53V5.4H1.87A8 8 0 0 0 .98 9c0 1.29.31 2.51.89 3.6l2.64-2.07z"
      />
      <path
        fill="#EA4335"
        d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 .89 5.4L3.53 7.47c.63-1.89 2.39-3.89 5.45-3.89z"
      />
    </svg>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="leading-snug">{text}</p>
    </div>
  );
}
