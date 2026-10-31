'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { CoachSummary } from '@/lib/compliance'
import { FoldBadge } from './badge'

/** Hidden on screen. When the page is printed, everything else is hidden and only this sheet shows (see globals.css). */
export function PrintSheet({ summaries, onDone }: { summaries: CoachSummary[]; onDone?: () => void }) {
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  useEffect(() => {
    if (!onDone) return
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    return () => window.removeEventListener('afterprint', done)
  }, [onDone])
  if (!origin || typeof document === 'undefined') return null
  return createPortal(
    <div className="badge-print">
      <div className="flex flex-wrap gap-x-[0.5in] gap-y-[0.3in]">
        {summaries.map((s) => <FoldBadge key={s.coach.id} summary={s} origin={origin} />)}
      </div>
    </div>,
    document.body,
  )
}
