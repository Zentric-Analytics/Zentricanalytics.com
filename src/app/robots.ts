import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/track/portal', '/track/verify'] },
    ],
    sitemap: 'https://zentricanalytics.com/sitemap.xml',
    host: 'https://zentricanalytics.com',
  };
}
