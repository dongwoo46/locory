'use client'

import { locales, type Locale } from './config'

export function setLocale(locale: Locale) {
  document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
  window.location.reload()
}

export function getClientLocale(): Locale {
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/)
  const val = match?.[1] as Locale | undefined
  return val && locales.includes(val) ? val : 'ko'
}
