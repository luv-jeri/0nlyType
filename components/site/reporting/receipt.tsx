"use client"

import * as React from "react"
import type { ReportFile } from "@/lib/reporting/client"
import type { Receipt } from "@/lib/reporting/contracts"
import { emailReceiptLabel, issueReceiptLabel } from "@/lib/reporting/receipt-labels"
import { Button } from "@/registry/0nlytype/ui/button"
import { Link } from "@/registry/0nlytype/ui/link"
import { Marker } from "@/registry/0nlytype/ui/marker"
import { toast } from "@/registry/0nlytype/ui/toast"
import { message, publicLink, STATUS_LABELS, uploaded } from "./shared"
import { fetchReceipt, uploadAttachment } from "./connection"

export function downloadReceipt(receipt: Pick<Receipt, "id" | "token">) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ id: receipt.id, token: receipt.token }, null, 2)], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `0nlytype-receipt-${receipt.id}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ReportReceipt({ receipt, title, files, externalBusy, onBusyChange, onChange, onNew }: {
  receipt: Receipt; title: string; files: ReportFile[]; externalBusy: string; onBusyChange: (busy: string) => void; onChange: (receipt: Receipt) => void; onNew: () => void
}) {
  const [busy, setBusy] = React.useState("")
  const [error, setError] = React.useState("")
  const running = React.useRef(false)
  const heading = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => { heading.current?.focus() }, [])
  const remaining = receipt.attachments.filter((file) => !uploaded(file.state) && file.state !== "expired")
  const componentUrl = publicLink(receipt.componentUrl)

  async function update(upload = false) {
    if (running.current || externalBusy) return
    running.current = true
    onBusyChange("Checking receipt")
    setError("")
    setBusy("Checking status")
    try {
      let current = await fetchReceipt(receipt.id, receipt.token)
      onChange(current)
      if (upload) {
        const failures: string[] = []
        for (const item of files) {
          if (!current.attachments.some((file) => file.id === item.id && !uploaded(file.state) && file.state !== "expired")) continue
          setBusy(`Uploading ${item.file.name}`)
          try {
            await uploadAttachment(current, item)
            current = { ...current, attachments: current.attachments.map((file) => file.id === item.id ? { ...file, state: "uploaded" } : file) }
            onChange(current)
          } catch (cause) { failures.push(`${item.file.name}: ${message(cause)}`) }
        }
        if (failures.length) setError(`Your report is received. These files still need uploading: ${failures.join(" ")}`)
        else toast("Attachments checked.")
      } else toast("Status checked.")
    } catch (cause) { setError(`Your saved receipt is still here. ${message(cause)}`) }
    finally { running.current = false; setBusy(""); onBusyChange("") }
  }

  return (
    <section className="ot-report-receipt" aria-labelledby="receipt-heading">
      <Marker dot role="status">{STATUS_LABELS[receipt.status]}</Marker>
      <h2 id="receipt-heading" ref={heading} tabIndex={-1}>Your words are with us.</h2>
      {title ? <p className="ot-report-receipt-title ot-yours" dir="auto">{title}</p> : null}
      <p>Keep this receipt to check progress. Receiving a report, sending an email and creating a tracking issue are separate steps.</p>
      <dl className="ot-report-ledger">
        <div><dt>Report</dt><dd>{STATUS_LABELS[receipt.status]}</dd></div>
        <div><dt>Email</dt><dd>{emailReceiptLabel(receipt)}</dd></div>
        <div><dt>Tracking issue</dt><dd>{issueReceiptLabel(receipt)}</dd></div>
        <div><dt>Receipt number</dt><dd className="ot-report-id">{receipt.id}</dd></div>
        {receipt.attachments.map((file, index) => <div key={file.id}>
          <dt><span className="ot-yours" dir="auto">{files.find((item) => item.id === file.id)?.file.name || `Attachment ${index + 1}`}</span></dt>
          <dd>{uploaded(file.state) ? "Uploaded" : file.state === "expired" ? "Expired" : "Awaiting upload"}</dd>
        </div>)}
      </dl>
      {componentUrl ? <Link href={componentUrl}>See the component</Link> : null}
      {remaining.length ? <p><bdi className="ot-report-number">{remaining.length}</bdi> {remaining.length === 1 ? "file still needs" : "files still need"} uploading. {files.length ? "Your originals are kept with this draft." : "The originals are not on this device. Open the receipt on the device you sent from to retry."}</p> : null}
      <p role="status" className="ot-report-note">{busy}</p>
      {error ? <p role="alert" className="ot-report-error">{error}</p> : null}
      <div className="ot-report-actions">
        <Button variant="bracket" disabled={Boolean(busy || externalBusy)} onClick={() => void update()}>Check status</Button>
        {remaining.length && files.length ? <Button variant="bracket" disabled={Boolean(busy || externalBusy)} onClick={() => void update(true)}>Retry uploads</Button> : null}
        <Button variant="quiet" onClick={() => { downloadReceipt(receipt); toast("Receipt download started.") }}>Download receipt</Button>
      </div>
      <p className="ot-report-note">The receipt file is private: anyone with it can check this report’s status. The browser copy expires seven days after a save. Download it before it expires, before starting another report, or before clearing browser storage.</p>
      <Button variant="quiet" disabled={Boolean(busy || externalBusy)} onClick={onNew}>Start another report</Button>
    </section>
  )
}
