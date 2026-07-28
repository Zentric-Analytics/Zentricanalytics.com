import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.zentricanalytics.com'),
  title: { default: 'Zentric Analytics', template: '%s | Zentric Analytics' },
  description: 'Zentric Analytics engineers reliable software, AI, data, and cloud systems for growing organizations.',
  applicationName: 'Zentric Analytics',
  manifest: '/manifest.webmanifest',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://www.zentricanalytics.com/#organization', name: 'Zentric Analytics', url: 'https://www.zentricanalytics.com/' },
      { '@type': 'WebSite', '@id': 'https://www.zentricanalytics.com/#website', url: 'https://www.zentricanalytics.com/', name: 'Zentric Analytics', publisher: { '@id': 'https://www.zentricanalytics.com/#organization' }, inLanguage: 'en' },
    ],
  };

  return (
    <html lang="en">
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      </body>
    </html>
  );
}
