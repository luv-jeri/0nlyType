"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { entries } from "@/lib/site/entries"
import { Button } from "@/registry/0nlytype/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetSpine, SheetTitle } from "@/registry/0nlytype/ui/sheet"
import { FeedbackForms } from "./forms"
import "@/registry/0nlytype/styles/sheet.css"
import "@/registry/0nlytype/styles/dialog.css"
import "./panel.css"

const components = entries.map(({ meta }) => ({ name: meta.name, title: meta.title, description: meta.summary, contract: meta.contract }))
export type ReportingPanelProps = { href: string; onClose: () => void }

export function ReportingPanel({ href, onClose }: ReportingPanelProps) {
  const [picking, setPicking] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const dialog = React.useRef<HTMLDialogElement>(null)
  return createPortal(<Sheet open={!picking} alert={busy} onOpenChange={(open) => { if (!open && !picking && !busy) onClose() }}>
    <SheetContent ref={dialog} className="ot-report-sheet" data-reporting-chrome data-lenis-prevent data-picking={picking || undefined} onCancel={(event) => { if (busy) event.preventDefault() }}>
      <SheetSpine>Feedback</SheetSpine>
      <header className="ot-report-sheet-head">
        <div className="ot-report-sheet-caption"><span>0nlyType / Feedback</span><Button variant="quiet" disabled={busy} onClick={onClose} aria-label="Close feedback">Close</Button></div>
        <SheetTitle tabIndex={-1} data-autofocus>Make it<br />better.</SheetTitle>
        <SheetDescription>A rough edge. A missing piece.<br />Tell us what would help.</SheetDescription>
      </header>
      <FeedbackForms entries={components} presentation="panel" href={href} onPickingChange={setPicking} onBusyChange={setBusy} />
    </SheetContent>
  </Sheet>, document.body)
}
