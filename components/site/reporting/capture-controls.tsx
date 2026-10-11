"use client"

import { siteRoute } from "@/lib/site/config.mjs"
import * as React from "react"
import { createPortal } from "react-dom"
import { cropImage, type Crop } from "@/lib/reporting/capture"
import { type ComponentMatch, type Pin } from "@/lib/reporting/contracts"
import { structuralPath } from "@/lib/reporting/diagnostics"
import { Button } from "@/registry/0nlytype/ui/button"
import { Field, Input } from "@/registry/0nlytype/ui/field"
import { FilePreview } from "./media"

export type ReportingItem = ComponentMatch & { contract?: string }
type Target = { element: Element; item: ReportingItem }
const excluded = "[data-reporting-chrome],[data-private],input,textarea,select,[contenteditable],nextjs-portal"

/** Docs' example/state markers name the specimen; elsewhere use the registry's own root contract. */
export function componentTarget(node: Element | null, entries: ReportingItem[]): Target | null {
  if (!node || node.closest(excluded)) return null
  const marked = node.closest("[data-reporting-item],[data-component],.doc-example,.doc-state")
  const docName = siteRoute(location.pathname).match(/^\/docs\/([^/]+)/)?.[1]
  const name = marked?.getAttribute("data-reporting-item") || marked?.getAttribute("data-component") || (marked ? docName : null)
  const named = entries.find((entry) => entry.name === name)
  if (marked && named) {
    const root = named.contract ? node.closest(`.${CSS.escape(named.contract)}`) : null
    return { element: root && marked.contains(root) ? root : marked, item: named }
  }
  for (let element: Element | null = node; element && element !== document.body; element = element.parentElement) {
    const item = entries.find((entry) => element!.getAttribute("data-slot") === entry.name || (entry.contract && element!.classList.contains(entry.contract)))
    if (item && element.getBoundingClientRect().width > 0) return { element, item }
  }
  return null
}

export function pinTarget(pin: Pin, entries: ReportingItem[]) {
  try { return componentTarget(document.querySelector(pin.path), entries)?.item.title }
  catch { return undefined }
}

export function CropEditor({ file, onAccept, onCancel }: { file: File; onAccept: (file: File) => Promise<void>; onCancel: () => void }) {
  const [crop, setCrop] = React.useState<Crop>({ x: 0, y: 0, width: 100, height: 100 })
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const area = React.useRef<HTMLDivElement>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const start = React.useRef<{ x: number; y: number } | null>(null)
  const id = React.useId()
  React.useEffect(() => { heading.current?.focus() }, [])
  const point = (event: React.PointerEvent) => {
    const rect = area.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) }
  }
  return <section className="ot-report-crop" aria-labelledby={id} aria-busy={busy}>
    <h2 ref={heading} id={id} tabIndex={-1}>Keep what matters.</h2>
    <p className="ot-report-note">Review your screenshot. Drag a frame, or set the crop below. Fields and private regions are excluded; check the rest before sharing.</p>
    <div className="ot-report-crop-image" ref={area} onPointerDown={(event) => {
      if (busy || event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      start.current = point(event)
    }} onPointerMove={(event) => {
      if (!start.current) return
      const end = point(event), origin = start.current
      const x = Math.min(99, origin.x, end.x), y = Math.min(99, origin.y, end.y)
      setCrop({ x, y, width: Math.min(100 - x, Math.max(1, Math.abs(end.x - origin.x))), height: Math.min(100 - y, Math.max(1, Math.abs(end.y - origin.y))) })
    }} onPointerUp={() => { start.current = null }} onPointerCancel={() => { start.current = null }}>
      <FilePreview file={file} />
      <div className="ot-report-crop-outline" aria-hidden="true" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }} />
    </div>
    <div className="ot-report-crop-fields">{(["x", "y", "width", "height"] as const).map((key) => <Field key={key} label={{ x: "Left %", y: "Top %", width: "Width %", height: "Height %" }[key]}>
      <Input type="number" dir="ltr" min={key === "x" || key === "y" ? 0 : 1} max={key === "x" || key === "y" ? 99 : 100} step={1} disabled={busy} value={Math.round(crop[key])} onChange={(event) => {
        const value = Number(event.target.value)
        if (!Number.isFinite(value)) return
        const next = { ...crop, [key]: Math.max(key === "x" || key === "y" ? 0 : 1, Math.min(100, value)) }
        next.x = Math.min(99, next.x); next.y = Math.min(99, next.y)
        next.width = Math.min(next.width, 100 - next.x); next.height = Math.min(next.height, 100 - next.y)
        setCrop(next)
      }} />
    </Field>)}</div>
    <p className="ot-report-note" role="status">Crop: <bdi className="ot-report-number">{Math.round(crop.width)} × {Math.round(crop.height)}%</bdi> of the screenshot.</p>
    {error ? <p role="alert" className="ot-report-error">{error}</p> : null}
    <div className="ot-report-actions">
      <Button variant="bracket" disabled={busy} busy={busy && "Cropping"} onClick={async () => {
        setBusy(true); setError("")
        try { await onAccept(await cropImage(file, crop)) }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t crop this screenshot.") }
        finally { setBusy(false) }
      }}>Use this crop</Button>
      <Button variant="quiet" disabled={busy} onClick={onCancel}>Discard screenshot</Button>
    </div>
  </section>
}

export function ItemSearch({ entries, onSelect }: { entries: ReportingItem[]; onSelect: (item: ReportingItem) => void }) {
  const [query, setQuery] = React.useState("")
  const matches = entries.filter((entry) => `${entry.name} ${entry.title} ${entry.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="ot-report-item-search">
    <Field label="Search library items" hint="Type a name, then Tab to a result and press Enter."><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></Field>
    <p className="ot-report-note" role="status">{matches.length} {matches.length === 1 ? "item" : "items"}{matches.length > 12 ? "; first 12 shown. Keep typing to narrow the list." : "."}</p>
    <ul>{matches.slice(0, 12).map((item) => <li key={item.name}><Button variant="quiet" onClick={() => onSelect(item)}>{item.title}</Button><p className="ot-report-note">{item.description}</p></li>)}</ul>
  </div>
}

export function PinPicker({ entries, onSelect, onCancel }: { entries: ReportingItem[]; onSelect: (item: ReportingItem, pin: Pin) => void; onCancel: () => void }) {
  const [target, setTarget] = React.useState<Target | null>(null)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const toolbar = React.useRef<HTMLDivElement>(null)
  const [accent] = React.useState(() => getComputedStyle(document.documentElement).getPropertyValue("--ot-accent"))
  const callbacks = React.useRef({ onSelect, onCancel })
  const current = React.useRef<Target | null>(null)
  React.useEffect(() => { callbacks.current = { onSelect, onCancel } }, [onSelect, onCancel])
  React.useEffect(() => {
    const focus = requestAnimationFrame(() => toolbar.current?.focus())
    document.documentElement.dataset.reportingPicking = "true"
    const choose = (next: Target | null) => { current.current = next; setTarget(next); setRect(next?.element.getBoundingClientRect() ?? null) }
    const chrome = (event: Event) => event.target instanceof Element && Boolean(event.target.closest("[data-reporting-chrome]"))
    const intercept = (event: Event) => { if (!chrome(event)) { event.preventDefault(); event.stopImmediatePropagation() } }
    const select = (next: Target, x?: number, y?: number) => {
      const bounds = next.element.getBoundingClientRect()
      callbacks.current.onSelect(next.item, { path: structuralPath(next.element), tag: next.element.tagName.toLowerCase(), x: Math.min(100000, Math.max(0, (x ?? bounds.x + bounds.width / 2) + scrollX)), y: Math.min(100000, Math.max(0, (y ?? bounds.y + bounds.height / 2) + scrollY)) })
    }
    const move = (event: PointerEvent) => choose(componentTarget(event.target instanceof Element ? event.target : null, entries))
    const click = (event: MouseEvent) => {
      if (chrome(event)) return
      intercept(event)
      const next = componentTarget(event.target instanceof Element ? event.target : null, entries)
      if (next) select(next, event.clientX, event.clientY)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onCancel(); return }
      if (event.key === "Tab") {
        const controls: HTMLElement[] = [toolbar.current, ...Array.from(toolbar.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])].filter((element): element is HTMLDivElement | HTMLButtonElement => Boolean(element))
        const index = controls.indexOf(document.activeElement as HTMLElement)
        event.preventDefault(); event.stopImmediatePropagation()
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
      } else if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation()
        const targets = Array.from(document.querySelectorAll("[data-slot],.doc-example,[data-reporting-item],[data-component]"))
          .map((element) => componentTarget(element, entries)).filter((value): value is Target => Boolean(value && value.element.getClientRects().length))
          .filter((value, index, all) => all.findIndex((other) => other.element === value.element) === index)
        const index = targets.findIndex((value) => value.element === current.current?.element)
        const next = targets[(index + (["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1) + targets.length) % targets.length]
        if (next) { next.element.scrollIntoView({ block: "nearest", behavior: "instant" }); choose(next) }
      } else if ((event.key === "Enter" || event.key === " ") && event.target === toolbar.current) {
        event.preventDefault(); event.stopImmediatePropagation()
        if (current.current) select(current.current)
      }
    }
    const measure = () => setRect(current.current?.element.getBoundingClientRect() ?? null)
    document.addEventListener("pointerdown", intercept, true)
    document.addEventListener("pointerup", intercept, true)
    document.addEventListener("click", click, true)
    document.addEventListener("auxclick", intercept, true)
    document.addEventListener("contextmenu", intercept, true)
    document.addEventListener("pointermove", move, true)
    document.addEventListener("keydown", key, true)
    window.addEventListener("scroll", measure, true)
    window.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(focus)
      delete document.documentElement.dataset.reportingPicking
      document.removeEventListener("pointerdown", intercept, true)
      document.removeEventListener("pointerup", intercept, true)
      document.removeEventListener("click", click, true)
      document.removeEventListener("auxclick", intercept, true)
      document.removeEventListener("contextmenu", intercept, true)
      document.removeEventListener("pointermove", move, true)
      document.removeEventListener("keydown", key, true)
      window.removeEventListener("scroll", measure, true)
      window.removeEventListener("resize", measure)
    }
  }, [entries])
  return createPortal(<div className="ot-report-picker" data-reporting-chrome style={{ "--ot-report-accent": accent } as React.CSSProperties}>
    {rect && target ? <div className="ot-report-pin-frame" aria-hidden="true" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}><span className="ot-report-pin-name" data-below={rect.top < 40 || undefined}>{target.item.title}</span></div> : null}
    <div className="ot-report-picker-toolbar" ref={toolbar} tabIndex={-1} role="dialog" aria-label="Pick the item" aria-describedby="ot-report-picker-help">
      <div className="ot-report-actions"><strong>Pick the item.</strong><Button variant="quiet" onClick={onCancel}>Cancel picking</Button></div>
      <p id="ot-report-picker-help">Point, then click. Arrow keys browse; Enter selects. Escape cancels.</p>
      <p role="status">{target ? <>Click to select <span className="ot-yours">{target.item.title}</span>.</> : "Choose a component on this page. Page actions are paused."}</p>
    </div>
  </div>, document.body)
}
