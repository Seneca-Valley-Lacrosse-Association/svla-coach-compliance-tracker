import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Document not found.' }, { status: 404, headers })
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to view certificates.' }, { status: 401, headers })
  const { data, error } = await db.from('submissions').select('file_path,file_name').eq('id', id).single()
  if (error || !data?.file_path) return NextResponse.json({ error: 'Document not found.' }, { status: 404, headers })
  const signed = await db.storage.from('certificates').createSignedUrl(data.file_path, 60, { download: data.file_name || true })
  if (signed.error) return NextResponse.json({ error: 'Unable to download this document.' }, { status: 500, headers })
  return NextResponse.redirect(signed.data.signedUrl, { status: 302, headers })
}
