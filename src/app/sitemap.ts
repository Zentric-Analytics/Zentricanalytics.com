import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.zentricanalytics.com').replace(/\/$/, '');
  return ['', '/about', '/services', '/industries', '/careers', '/contact', '/apply', '/track'].map((path) => ({
    url: `${baseUrl}${path || '/'}`,
    changeFrequency: path === '' ? 'weekly' as const : 'monthly' as const,
    priority: path === '' ? 1 : 0.7,
  }));
}
