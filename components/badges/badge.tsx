'use client'

import { QRCodeSVG } from 'qrcode.react'
import { badgeRole, badgeValidThrough, type CoachSummary, type ProgramSummary } from '@/lib/compliance'
import { PROGRAM_LABELS } from '@/lib/types'

// Printed badge. Portrait card size, white background, fixed colors: it is paper, so it ignores the app theme.
const US_DATE = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${m}/${d}/${y}` }

function programsLine(summary: CoachSummary) {
  const names = summary.programs.filter((p) => p.assigned).map((p) => PROGRAM_LABELS[p.program])
  return names.join(' and ')
}

function Box({ p }: { p: ProgramSummary }) {
  const label = PROGRAM_LABELS[p.program]
  const yes = p.cleared
  return (
    <div className="rounded-md border-2 px-1 py-1 text-center" style={yes ? { borderColor: '#0b7a43', background: '#e3f4ea', color: '#0b7a43' } : { borderColor: '#9aa6b2', background: '#f3f5f8', color: '#5b6875' }}>
      <b className="block text-[26px] leading-none" style={{ fontFamily: 'var(--font-sans)' }}>{yes ? 'YES' : p.assigned ? 'NO' : '—'}</b>
      <span className="block text-[10px] font-semibold uppercase tracking-wider">{label}{!p.assigned ? ' · not assigned' : ''}</span>
    </div>
  )
}

export function Badge({ summary, origin }: { summary: CoachSummary; origin: string }) {
  const { coach } = summary
  const through = badgeValidThrough(summary)
  const url = `${origin}/verify/${coach.verifyToken ?? ''}`
  const [first, ...rest] = coach.name.trim().split(/\s+/)
  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border bg-white text-[#12202e]" style={{ width: '3in', height: '4in', borderColor: '#b9c4cf', breakInside: 'avoid' }}>
      <div className="px-4 pb-2 pt-2.5" style={{ background: '#0e2a44', color: '#fff' }}>
        <p className="text-[24px] font-bold leading-none tracking-wider">SVLA</p>
        <p className="mt-1 whitespace-nowrap text-[10.5px] font-semibold tracking-wider opacity-85">SENECA VALLEY LACROSSE ASSOCIATION</p>
      </div>
      <div className="px-4 pt-2.5">
        <p className="text-[29px] font-bold uppercase leading-[1.02]">{first}<br />{rest.join(' ')}</p>
        <p className="mt-1 text-[13px] font-semibold" style={{ color: '#4b5a69' }}>{badgeRole(coach)} · {programsLine(summary)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-2.5">{summary.programs.map((p) => <Box key={p.program} p={p} />)}</div>
      <div className="mt-auto flex items-center gap-3 px-4 pb-1.5">
        <QRCodeSVG value={url} size={80} level="M" marginSize={0} fgColor="#12202e" bgColor="#ffffff" aria-label="QR code to verify this badge" />
        <p className="text-[10.5px] leading-tight" style={{ color: '#4b5a69' }}><b className="block text-[12.5px]" style={{ color: '#12202e' }}>Scan to verify</b>Live status and USA Lacrosse details</p>
      </div>
      <div className="px-4 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/svla-logo.jpg" alt="" className="mx-auto h-auto w-[1.9in]" />
      </div>
      <div className="flex items-baseline justify-between px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ background: '#0e2a44', color: '#fff' }}>
        <span>Valid through</span><b className="text-[16px] tracking-wide">{through ? US_DATE(through) : '—'}</b>
      </div>
    </div>
  )
}

/** Two identical badges side by side with a fold line between them: fold, slide into a badge holder, same on both sides. */
export function FoldBadge({ summary, origin }: { summary: CoachSummary; origin: string }) {
  return (
    <div className="flex items-stretch" style={{ breakInside: 'avoid' }}>
      <Badge summary={summary} origin={origin} />
      <div aria-hidden="true" className="relative" style={{ width: 0, borderLeft: '1px dashed #8896a5' }}>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap bg-white px-1 text-[7px] uppercase tracking-widest" style={{ color: '#8896a5' }}>fold</span>
      </div>
      <Badge summary={summary} origin={origin} />
    </div>
  )
}
