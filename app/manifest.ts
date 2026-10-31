import type { MetadataRoute } from 'next'

// Used when someone adds the tracker to an Android home screen. iPhones use /apple-icon.png instead.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SVLA Compliance',
    short_name: 'SVLA Compliance',
    description: 'Track coach clearances, trainings, and certifications for the SVLA youth lacrosse association.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0E2A44',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
