"use client"

import { siteURL } from "@/lib/site/config.mjs"
import * as React from "react"

import { KEYS, PAIRS, SCHEMES, useTheme } from "@/components/site/theme-controls"
import { ModeToggle } from "@/registry/0nlytype/ui/mode-toggle"
import { Select } from "@/registry/0nlytype/ui/select"

// The home page's small instruments: the ones that answer a hand. Everything else on the page is a server component.

/** One note of colour: the whole page, retuned from one sentence. */
export function TuneSentence() {
  const [theme, set] = useTheme()
  return (
    <p className="tune-sentence">
      Print it in{" "}
      <span className="tune-bind">
        <Select aria-label="Scheme" value={theme.scheme ?? "cotton"} onChange={(e) => set({ scheme: e.target.value }, e.currentTarget)}>
          {SCHEMES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        ,
      </span>{" "}
      set it in{" "}
      <span className="tune-bind">
        <Select aria-label="Typefaces" value={theme.pair ?? "parma"} onChange={(e) => set({ pair: e.target.value }, e.currentTarget)}>
          {PAIRS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.words}
            </option>
          ))}
        </Select>
        ,
      </span>{" "}
      key it to{" "}
      <span className="tune-bind">
        <Select aria-label="Accent" rootClassName="tune-key" value={theme.key ?? ""} onChange={(e) => set({ key: e.target.value || undefined }, e.currentTarget)}>
          <option value="">its own colour</option>
          {KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
        ,
      </span>{" "}
      and read it by{" "}
      <span className="tune-bind">
        <ModeToggle variant="words" aria-label="Read it by night" mode={theme.mode === "nocturne" ? "nocturne" : "day"} onModeChange={(m, e) => set({ mode: m }, e.currentTarget)} />.
      </span>
    </p>
  )
}

/** The install line as one press: the whole command, the reader's part in italic; pressing copies it. */
export function CopyCommand({ command, emphasis }: { command: string; emphasis?: string }) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef(0)
  React.useEffect(() => () => clearTimeout(timer.current), [])
  const at = emphasis ? command.lastIndexOf(emphasis) : -1
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <>
      <button type="button" className="copy-cmd" data-copied={copied || undefined} onClick={copy}>
        <code className="copy-cmd-text" dir="ltr">
          {at < 0 || !emphasis ? (
            command
          ) : (
            <>
              {command.slice(0, at)}
              <i>{emphasis}</i>
              {command.slice(at + emphasis.length)}
            </>
          )}
        </code>
        <span className="copy-cmd-word" data-text="Copied">
          <span>{copied ? "Copied" : "Copy"}</span>
        </span>
      </button>
      <span className="ot-sr" aria-live="polite">
        {copied ? "Copied to the clipboard." : ""}
      </span>
    </>
  )
}

/**
 * Share: the system's own sheet where there is one, else the link is copied. Plain words, no glyph.
 * The label says what happened after: "Link copied", read out once.
 */
export function Share({ url, title, children }: { url: string; title: string; children: string }) {
  const [copied, setCopied] = React.useState(false)
  const t = React.useRef(0)
  React.useEffect(() => () => clearTimeout(t.current), [])
  async function share() {
    const href = siteURL(url)
    if (navigator.share) {
      try {
        await navigator.share({ title, url: href })
        return
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      clearTimeout(t.current)
      t.current = window.setTimeout(() => setCopied(false), 2400)
    } catch {}
  }
  return (
    <>
      <button type="button" className="share" data-copied={copied || undefined} onClick={share}>
        {copied ? "Link copied" : children}
      </button>
      <span className="ot-sr" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </>
  )
}
