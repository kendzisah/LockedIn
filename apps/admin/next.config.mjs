/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@lockedin/shared-types',
    '@lockedin/supabase-client',
  ],
};

export default nextConfig;
