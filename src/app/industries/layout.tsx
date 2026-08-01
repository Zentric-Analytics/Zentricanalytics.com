import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Technology Solutions Adapted to Your Industry',
  description: 'See how Zentric Analytics adapts engineering delivery to sector users, regulation, governance, workflows, and desired outcomes.',
  alternates: { canonical: '/industries' },
  openGraph: { title: 'Industries | Zentric Analytics', description: 'See how Zentric Analytics adapts engineering delivery to sector users, regulation, governance, workflows, and desired outcomes.', url: '/industries', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
