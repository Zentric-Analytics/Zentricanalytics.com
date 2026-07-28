/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Cache generated variants without making replaceable public-file URLs immutable.
    minimumCacheTTL: 86400,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
