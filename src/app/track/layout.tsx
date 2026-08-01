import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Your Zentric Analytics Application',
  description: 'Use your application ID and email to receive a secure code and view updates in the Zentric Analytics candidate portal.',
  alternates: { canonical: '/track' },
  openGraph: { title: 'Track Your Application | Zentric Analytics', description: 'Use your application ID and email to receive a secure code and view updates in the Zentric Analytics candidate portal.', url: '/track', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
