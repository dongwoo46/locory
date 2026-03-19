import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/next'
import QueryProvider from '@/components/providers/QueryProvider'
import Script from 'next/script'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Locory',
  description: '여행자들의 장소 이야기',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9095120612475154"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${geist.variable} antialiased`}>
        <QueryProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
            <Analytics />
          </NextIntlClientProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
