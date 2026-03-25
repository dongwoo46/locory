import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

async function loadMessages(locale: Locale) {
  switch (locale) {
    case 'en':    return (await import('../../messages/en.json')).default
    case 'ja':    return (await import('../../messages/ja.json')).default
    case 'zh-CN': return (await import('../../messages/zh-CN.json')).default
    case 'zh-TW': return (await import('../../messages/zh-TW.json')).default
    case 'es':    return (await import('../../messages/es.json')).default
    case 'ru':    return (await import('../../messages/ru.json')).default
    default:      return (await import('../../messages/ko.json')).default
  }
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('locale')?.value as Locale | undefined
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale

  return {
    locale,
    messages: await loadMessages(locale),
  }
})
