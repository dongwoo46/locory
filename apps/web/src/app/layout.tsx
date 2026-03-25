import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/next';
import QueryProvider from '@/components/providers/QueryProvider';
import ThirdPartyScripts from '@/components/providers/ThirdPartyScripts';
import './globals.css';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Locory',
  description: '여행자들의 장소 이야기',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const supabaseOrigin = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  })();

  return (
    <html lang={locale}>
      <head>
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}
      </head>
      <body className={`${geist.variable} antialiased`}>
        <QueryProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            {children}
            <Analytics />
            <ThirdPartyScripts />
          </NextIntlClientProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
