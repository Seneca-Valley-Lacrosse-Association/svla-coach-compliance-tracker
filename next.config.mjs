/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }]
  },
  images: {
    unoptimized: true,
  },
  // The PDF board report embeds these fonts, read from disk at runtime.
  outputFileTracingIncludes: { '/api/surveys/[id]/export': ['./public/fonts/**'] },
  serverExternalPackages: ['@react-pdf/renderer'],
}

export default nextConfig
