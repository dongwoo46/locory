'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'

const CRITICAL_ROUTES = ['/feed', '/map', '/upload', '/saved']

export default function ThirdPartyScripts() {
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const isCriticalRoute = CRITICAL_ROUTES.some((route) => pathname?.startsWith(route))
    if (isCriticalRoute) {
      setEnabled(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null
    const onReady = () => setEnabled(true)

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(onReady, { timeout: 3000 })
    } else {
      timeoutId = setTimeout(onReady, 3000)
    }

    return () => {
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [pathname])

  if (!enabled) return null

  return (
    <>
      <Script
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9095120612475154"
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
    </>
  )
}
