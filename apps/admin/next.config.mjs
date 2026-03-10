/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@lockedin/shared-types',
    '@lockedin/supabase-client',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tools.applemediaservices.com',
      },
    ],
  },
};

export default nextConfig;
