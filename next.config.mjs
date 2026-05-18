/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
    serverActions: {
      bodySizeLimit: '100mb'
    }
  },
  allowedDevOrigins: ['10.0.0.2', 'localhost']
};

export default nextConfig;