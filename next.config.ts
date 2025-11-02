import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Optimize for Vercel deployment
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Webpack configuration for bot files
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude bot files from client bundle
      config.externals = [...(config.externals || []), 'telegraf'];
    }
    return config;
  },
};

export default nextConfig;
