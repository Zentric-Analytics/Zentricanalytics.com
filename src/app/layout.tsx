import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://zentricanalytics.com'),
  title: { default: 'Technology Consultancy for Software, Data & AI', template: '%s | Zentric Analytics' },
  description: 'Zentric Analytics helps organizations improve operations through dependable software, data, AI, and cloud engineering.',
  alternates: { canonical: '/' },
  openGraph: { title: 'Zentric Analytics | Technology Consultancy', description: 'Zentric Analytics helps organizations improve operations through dependable software, data, AI, and cloud engineering.', url: '/', siteName: 'Zentric Analytics', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <head />
      <body>{children}</body>
    </html>
  );
}
