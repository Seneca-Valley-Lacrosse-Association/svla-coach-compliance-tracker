import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { AppProvider } from '@/lib/app-store'
import { AppShell } from '../components/app-shell'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'SVLA Compliance',
  description:
    'Track coach clearances, trainings, and certifications for the SVLA youth lacrosse association.',
  generator: 'v0.app',
  appleWebApp: { title: 'SVLA Compliance' },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/apple-icon.png', sizes: '180x180' },
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0E2A44',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} bg-background`}>
      <body className="font-sans antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
