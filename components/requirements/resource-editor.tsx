'use client'

import { useId, useState, type FormEvent } from 'react'
import { useApp } from '@/lib/app-store'
import type { Requirement } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function ResourceEditor({ requirement }: { requirement: Requirement }) {
  const { updateResource, isDemo } = useApp()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(requirement.help)
  const [helpUrl, setHelpUrl] = useState(requirement.helpUrl)
  const [helpLinkLabel, setHelpLinkLabel] = useState(requirement.helpLinkLabel)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { await updateResource(requirement.id, { help, helpUrl, helpLinkLabel }); setOpen(false) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save resource.') }
    finally { setBusy(false) }
  }
  return <>
    <Button variant="link" size="sm" disabled={isDemo} onClick={() => setOpen(true)}>Edit instructions / link</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>Edit resource</DialogTitle><DialogDescription>{requirement.name}. Use the current approved document or provider link.</DialogDescription></DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor={`${id}-help`}>Instructions</FieldLabel><Textarea id={`${id}-help`} value={help} onChange={e => setHelp(e.target.value)} required maxLength={3000} /></Field>
            <Field><FieldLabel htmlFor={`${id}-url`}>HTTPS document or help URL</FieldLabel><Input id={`${id}-url`} type="url" value={helpUrl} onChange={e => setHelpUrl(e.target.value)} placeholder="https://" /></Field>
            <Field><FieldLabel htmlFor={`${id}-label`}>Link label</FieldLabel><Input id={`${id}-label`} value={helpLinkLabel} onChange={e => setHelpLinkLabel(e.target.value)} maxLength={150} /></Field>
          </FieldGroup>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save resource'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>
}
