import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Zentric Analytics',
  description: 'Learn why Zentric Analytics exists, how we work with organizations, and the principles that guide our technology decisions.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About Zentric Analytics', description: 'Learn why Zentric Analytics exists, how we work with organizations, and the principles that guide our technology decisions.', url: '/about', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
