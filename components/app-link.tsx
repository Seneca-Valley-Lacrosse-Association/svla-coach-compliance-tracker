'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'

export default function AppLink({ href, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname()
  const demo = pathname === '/demo' || pathname.startsWith('/demo/')
  const target = demo && typeof href === 'string' && href.startsWith('/') && !href.startsWith('/demo') ? `/demo${href === '/' ? '' : href}` : href
  return <Link href={target} {...props} />
}
