import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Technology Careers at Zentric Analytics',
  description: 'Explore engineering, AI, data, web, and research roles in a team that values ownership, learning, communication, quality, and respect.',
  alternates: { canonical: '/careers' },
  openGraph: { title: 'Careers | Zentric Analytics', description: 'Explore engineering, AI, data, web, and research roles in a team that values ownership, learning, communication, quality, and respect.', url: '/careers', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
