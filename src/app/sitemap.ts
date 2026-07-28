import type { MetadataRoute } from 'next';

const publicRoutes = ['', '/about', '/services', '/industries', '/careers', '/contact', '/apply', '/track', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-07-28');

  return publicRoutes.map((route) => ({
    url: `https://zentricanalytics.com${route}`,
    lastModified,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
