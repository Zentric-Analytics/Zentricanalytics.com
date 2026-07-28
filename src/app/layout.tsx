import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

const googleFontsUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Manrope:wght@600;700;800&display=swap';

export const metadata: Metadata = {
  title: 'Zentric Analytics',
  description: 'Technology company website and hiring enrollment portal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" as="style" href={googleFontsUrl} />
        <link id="google-fonts-stylesheet" rel="stylesheet" href={googleFontsUrl} media="print" />
        <noscript><link rel="stylesheet" href={googleFontsUrl} /></noscript>
      </head>
      <body>
        {children}
        <Script id="activate-google-fonts" strategy="beforeInteractive">
          {`document.getElementById('google-fonts-stylesheet').media='all'`}
        </Script>
      </body>
    </html>
  );
}
