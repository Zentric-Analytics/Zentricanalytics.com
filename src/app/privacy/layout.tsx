import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Notice',
  description: 'Learn what information Zentric Analytics collects through enquiries, recruitment, and website operations, and how that information is handled.',
  alternates: { canonical: '/privacy' },
  openGraph: { title: 'Privacy | Zentric Analytics', description: 'Learn what information Zentric Analytics collects through enquiries, recruitment, and website operations, and how that information is handled.', url: '/privacy', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
