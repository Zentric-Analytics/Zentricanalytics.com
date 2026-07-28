import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Software, AI, Data & Cloud Engineering Services',
  description: 'Explore custom software, web, AI, data, research, and cloud engineering capabilities designed around operational outcomes.',
  alternates: { canonical: '/services' },
  openGraph: { title: 'Engineering Services | Zentric Analytics', description: 'Explore custom software, web, AI, data, research, and cloud engineering capabilities designed around operational outcomes.', url: '/services', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
