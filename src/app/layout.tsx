import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zentric Analytics',
  description: 'Technology company website and hiring enrollment portal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
