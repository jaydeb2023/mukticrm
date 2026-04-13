/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      // Remove Supabase storage pattern if you're not using it
      // { protocol: 'https', hostname: '*.supabase.co' },
      // Add Neon / your own CDN here if needed later, e.g.:
      // { protocol: 'https', hostname: 'your-cdn.example.com' },
    ],
  },
};

export default nextConfig;
