'use client'

import useSWR from 'swr'
import { useApp } from '@/lib/app-store'
import type { TicketsSnapshot } from '@/lib/tickets'

async function load(url: string): Promise<TicketsSnapshot> {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to load help requests.')
  return result
}

/** The signed-in person's help requests: their own for a coach, every ticket for the board. Not used in the demo. */
export function useTickets() {
  const { isDemo } = useApp()
  return useSWR<TicketsSnapshot>(isDemo ? null : '/api/tickets', load, { refreshInterval: 60000, shouldRetryOnError: false })
}
