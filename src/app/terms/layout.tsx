import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Website Terms',
  description: 'Review the terms for using the Zentric Analytics website, enquiry forms, recruitment tools, and informational content.',
  alternates: { canonical: '/terms' },
  openGraph: { title: 'Terms | Zentric Analytics', description: 'Review the terms for using the Zentric Analytics website, enquiry forms, recruitment tools, and informational content.', url: '/terms', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
