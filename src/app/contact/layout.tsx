import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Zentric Analytics About Your Project',
  description: 'Tell Zentric Analytics about an operational challenge, digital product, or technology project. Our team typically responds within one business day.',
  alternates: { canonical: '/contact' },
  openGraph: { title: 'Contact Zentric Analytics', description: 'Tell Zentric Analytics about an operational challenge, digital product, or technology project. Our team typically responds within one business day.', url: '/contact', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
