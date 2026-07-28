import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zentric Analytics',
    short_name: 'Zentric',
    description: 'Software, AI, data, and cloud engineering for serious work.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0B1F3A',
  };
}
