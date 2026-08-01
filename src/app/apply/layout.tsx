import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply to Zentric Analytics',
  description: 'Submit your candidate details, role preferences, experience, CV, and declarations for first-stage recruitment review.',
  alternates: { canonical: '/apply' },
  openGraph: { title: 'Apply | Zentric Analytics', description: 'Submit your candidate details, role preferences, experience, CV, and declarations for first-stage recruitment review.', url: '/apply', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
