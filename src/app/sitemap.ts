import type { MetadataRoute } from 'next';

const routes = ['', '/about', '/services', '/industries', '/careers', '/contact', '/apply', '/track', '/privacy', '/terms'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://zentricanalytics.com';
  return routes.map((route) => ({ url: `${baseUrl}${route}`, changeFrequency: route === '' ? 'weekly' : 'monthly' }));
}
