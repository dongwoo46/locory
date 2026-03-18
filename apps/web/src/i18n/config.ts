export const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'ru'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ko'

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  es: 'Español',
  ru: 'Русский',
}

// 언어 선택 UI에 표시할 locale (zh-CN은 파일만 유지, 선택에서 제외)
export const displayLocales = ['ko', 'en', 'ja', 'zh-TW', 'es', 'ru'] as const satisfies Locale[]
