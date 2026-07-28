import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.zentricanalytics.com';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin/'] }],
    sitemap: `${baseUrl.replace(/\/$/, '')}/sitemap.xml`,
  };
}
