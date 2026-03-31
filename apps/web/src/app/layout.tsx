import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/next';
import QueryProvider from '@/components/providers/QueryProvider';
import ThirdPartyScripts from '@/components/providers/ThirdPartyScripts';
import IntroModal from '@/components/ui/IntroModal';
import './globals.css';

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
      <body className="antialiased">
        <QueryProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            {children}
            <IntroModal />
            <Analytics />
            <ThirdPartyScripts />
          </NextIntlClientProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
