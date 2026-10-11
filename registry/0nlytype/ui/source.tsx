"use client"

import * as React from "react"
import { highlight } from "sugar-high"

import { cn } from "@/registry/0nlytype/lib/utils"
import { roll } from "@/registry/0nlytype/lib/roll"
import { Button } from "@/registry/0nlytype/ui/button"

type SourceProps = Omit<React.ComponentProps<"figure">, "children"> & {
  code: string
  /** The file's name. Wide, it stands in the margin the way a score names its instrument. */
  title?: React.ReactNode
  /** Hide the Copy action. */
  noCopy?: boolean
  /**
   * system (the default): a bracket joins every line. gloss: whole-line comments leave the code for the
   * outer margin, beside the line they explain. passage: the bracket gathers to the lines in `passage`,
   * which stay in ink while the rest recede.
   */
  variant?: "system" | "gloss" | "passage"
  /** passage: the first and last line to mark, counted from 1. */
  passage?: [number, number]
  /** Turn long lines over, hanging (the default). false keeps each line whole and the lines scroll sideways under the numbers. */
  wrap?: boolean
  /** The language, named in the margin under the file's name, the way a score marks its key. */
  language?: string
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * Indentation you can see: a proportional face makes two spaces nearly nothing, so each line's
 * leading spaces become --i (a tab counts two) and the line is indented by that many half-ems.
 * Turnovers hang beneath it, like verse.
 */
function indent(html: string, code: string, variant: SourceProps["variant"], passage?: [number, number]) {
  const src = code.split("\n")
  const lead = src.map((l) => l.match(/^[ \t]*/)![0])
  const lines = html.split("\n").map((line, n) => {
    const space = lead[n] ?? ""
    let drop = space.length
    const depth = space.length + (space.match(/\t/g)?.length ?? 0)
    // gloss: a line that is only a comment becomes a note; its slashes are dropped where it stands in the margin.
    const note = variant === "gloss" ? src[n]?.match(/^\s*\/\/\s?(.*)$/) : null
    if (note)
      return `<span class="sh__line" data-gloss><span class="sh__token--comment"><span class="ot-source-slashes">// </span>${escape(note[1])}</span></span>`
    let out = ""
    let i = 0
    while (i < line.length && drop > 0) {
      if (line[i] === "<") {
        const end = line.indexOf(">", i) + 1
        out += line.slice(i, end)
        i = end
      } else if (line[i] === " " || line[i] === "\t") {
        drop--
        i++
      } else break
    }
    const marked = variant === "passage" && passage && n + 1 >= passage[0] && n + 1 <= passage[1]
    const attrs = marked ? `data-passage style="--i:${depth};--k:${n + 1 - passage[0]}"` : `style="--i:${depth}"`
    return (out + line.slice(i)).replace(/^<span class="sh__line">/, `<span class="sh__line" ${attrs}>`)
  })
  // Consecutive notes travel together, so a note of two lines stays one block beside its line.
  let joined = ""
  lines.forEach((l, n) => {
    const gloss = l.includes("data-gloss")
    const was = n > 0 && lines[n - 1].includes("data-gloss")
    if (gloss && !was) joined += `<span class="ot-source-gloss">`
    if (!gloss && was) joined += `</span>`
    joined += l
  })
  if (lines.at(-1)?.includes("data-gloss")) joined += `</span>`
  return joined // the lines are blocks: a newline between them would open a blank line
}

/**
 * Code, set as type. Weight is the only highlighting: the language's words are ink at 500, signs recede
 * to pencil, and what someone wrote (strings, JSX text, comments) is the expression italic.
 * A bracket joins the lines like a system in a score; copying runs the accent down it once.
 */
function Source({ code, title, noCopy = false, variant = "system", passage, wrap = true, language, className, ...props }: SourceProps) {
  const text = code.replace(/\n$/, "")
  const [from, to] = passage ?? [0, 0]
  const html = React.useMemo(() => indent(highlight(text), text, variant, [from, to]), [text, variant, from, to])
  const [copied, setCopied] = React.useState(0)
  const pre = React.useRef<HTMLPreElement>(null)

  // gloss: two notes on neighbouring lines would sit on each other, so a note that would overlap the one
  // above steps down just clear of it, the way a book's sidenotes queue.
  React.useLayoutEffect(() => {
    const el = pre.current
    if (variant !== "gloss" || !el) return
    const notes = [...el.querySelectorAll<HTMLElement>(".ot-source-gloss")]
    const lay = () => {
      notes.forEach((n) => (n.style.translate = ""))
      el.style.removeProperty("--ot-source-tail")
      if (getComputedStyle(notes[0] ?? el).position !== "absolute") return
      let floor = -Infinity
      for (const n of notes) {
        const r = n.getBoundingClientRect()
        const push = Math.max(0, floor - r.top)
        if (push) n.style.translate = `0 ${push}px`
        floor = r.bottom + push + 4
      }
      const over = floor - el.getBoundingClientRect().bottom
      if (over > 0) el.style.setProperty("--ot-source-tail", `${over}px`)
    }
    lay()
    const ro = new ResizeObserver(lay)
    ro.observe(el)
    return () => ro.disconnect()
  }, [variant, html, copied])

  return (
    <figure data-slot="source" data-variant={variant} data-wrap={wrap ? undefined : "off"} data-copied={copied || undefined} className={cn("ot-source", className)} {...props}>
      <div className="ot-source-frame">
        {title || language || !noCopy ? (
          <figcaption data-slot="source-meta" className="ot-source-meta">
            {title ? <span className="ot-source-name">{typeof title === "string" ? named(title) : title}</span> : null}
            {language ? <span className="ot-source-lang">{language}</span> : null}
            {noCopy ? null : <CopyButton text={code} onCopied={() => setCopied((c) => c + 1)} />}
          </figcaption>
        ) : null}
        {/* Code reads left to right on any page. Keyed by the copy count, so each copy replays the run down the bracket. */}
        {/* Unwrapped, the lines scroll inside <code> while the numbers and the bracket stay on the <pre>; the scroller takes focus, so the arrows scroll it. */}
        <pre ref={pre} key={copied} className="ot-source-code" dir="ltr" tabIndex={wrap ? 0 : undefined} data-lines={text.split("\n").length}>
          <code tabIndex={wrap ? undefined : 0} dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </figure>
  )
}

/** A file name with its extension set back in pencil; a long path may break after a slash. */
function named(title: string) {
  const dot = title.lastIndexOf(".")
  const cut = dot > 0 && dot > title.lastIndexOf("/") ? dot : title.length
  return (
    <>
      {title
        .slice(0, cut)
        .split(/(?<=\/)/)
        .map((part, i) => (
          <React.Fragment key={i}>
            {i ? <wbr /> : null}
            {part}
          </React.Fragment>
        ))}
      {cut < title.length ? <span className="ot-source-ext">{title.slice(cut)}</span> : null}
    </>
  )
}

type CopyButtonProps = React.ComponentProps<typeof Button> & {
  text: string
  /** Called once the text is on the clipboard. */
  onCopied?: () => void
}

/** Copy keeps its name through the flow: Copy, then Copied. */
function CopyButton({ text, onCopied, variant = "quiet", className, ...props }: CopyButtonProps) {
  const label = React.useRef<HTMLSpanElement>(null)
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => () => clearTimeout(timer.current), [])

  const show = (next: boolean) => {
    if (label.current) roll(label.current, () => setCopied(next), "0.5em", next ? 1 : -1)
    else setCopied(next)
  }

  return (
    <Button
      variant={variant}
      data-slot="source-copy"
      className={cn("ot-source-copy", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          return // the browser refused; the label stays "Copy", which is true
        }
        onCopied?.()
        show(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => show(false), 1800)
      }}
      {...props}
    >
      <span className="ot-source-copy-word">
        <span ref={label} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </span>
        {/* The room for the longer word, so Copied never moves what stands beside the button. */}
        <span aria-hidden="true">Copied</span>
      </span>
    </Button>
  )
}

export { Source, CopyButton, type SourceProps, type CopyButtonProps }
