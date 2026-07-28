import type { MetadataRoute } from 'next';

const routes = ['', '/about', '/services', '/industries', '/careers', '/contact', '/apply', '/track', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `https://zentricanalytics.com${route}`,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
