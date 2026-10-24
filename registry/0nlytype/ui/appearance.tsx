"use client"

import * as React from "react"

import { cn } from "@/registry/0nlytype/lib/utils"
import { ModeToggle } from "@/registry/0nlytype/ui/mode-toggle"
import { Pick, PickDescription, Picks, PickTitle } from "@/registry/0nlytype/ui/picks"

/** The four switches on <html>. Each is optional: no scheme is cotton, no key is the scheme's own, no pair is parma. */
type AppearanceValue = { mode?: string; scheme?: string; key?: string; pair?: string }

/** Where the choice is kept: one JSON object, the four switches together. */
const APPEARANCE_KEY = "0nlytype-theme"

const SCHEMES = ["cotton", "blueprint", "statue", "silence", "riso"]
/** Each scheme's own accent, by name, for the sentence. */
const OWN: Record<string, string> = { cotton: "ultramarine", blueprint: "orange", statue: "gold", silence: "cobalt", riso: "magenta" }
const KEYS = ["ultramarine", "viridian", "ember", "violet"]
const PAIRS = [
  { value: "parma", note: "Archivo, Bodoni Moda", words: "Archivo and Bodoni" },
  { value: "press", note: "Schibsted Grotesk, Newsreader", words: "Schibsted and Newsreader" },
  { value: "paris", note: "Instrument Sans, EB Garamond", words: "Instrument and Garamond" },
  { value: "salon", note: "Bricolage Grotesque, Cormorant", words: "Bricolage and Cormorant" },
]

// A pair's faces arrive only when the page first asks for them, so a new pair would open with the old letters and
// change again under the reader once its fonts landed. Pointing at the pairs fetches them; choosing one waits a moment
// for its faces before the page turns.
const WAIT = 400
/** The pair's two faces as font strings: the voice upright, the expression in its italic. */
function faces(pair = "parma") {
  const note = PAIRS.find((p) => p.value === pair)?.note
  if (!note) return []
  const [voice, expression] = note.split(", ")
  return [`400 1em "${voice}"`, `italic 400 1em "${expression}"`]
}
/** Starts fetching every pair's faces, so choosing one later need not wait. */
function warmPairs() {
  for (const p of PAIRS) for (const f of faces(p.value)) document.fonts.load(f).catch(() => {})
}

// The choice lives on <html>; everything reads it from there, so a head script, the page and every control agree.
// A choice still waiting for its faces is shown at once, so the control answers the press while the page waits.
const ATTRS = ["data-mode", "data-scheme", "data-key", "data-pair"]
let wanted: AppearanceValue | null = null
const waiting = new Set<() => void>()
function subscribe(changed: () => void) {
  const watch = new MutationObserver(changed)
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ATTRS })
  waiting.add(changed)
  return () => {
    watch.disconnect()
    waiting.delete(changed)
  }
}
function want(next: AppearanceValue | null) {
  wanted = next
  for (const changed of waiting) changed()
}
const snapshot = () => wanted
  ? [wanted.mode, wanted.scheme, wanted.key, wanted.pair].map((v) => v ?? "").join(" ")
  : ATTRS.map((a) => document.documentElement.getAttribute(a) ?? "").join(" ")
const parse = (s: string): AppearanceValue => {
  const [mode, scheme, key, pair] = s.split(" ").map((v) => v || undefined)
  return { mode, scheme, key, pair }
}

// A second change made while one waits builds on it (the hook reads the waiting choice), and only the last is drawn.
let turn = 0

/**
 * Put a choice on <html> and keep it. The new page opens as a circle from the control that changed it: the one given,
 * else the focused one. Reduced motion, or a browser without view transitions, changes it at once. A new pair waits
 * up to WAIT for its faces, so the page opens already set in them.
 */
function applyAppearance(next: AppearanceValue, from?: Element | null) {
  const root = document.documentElement
  const at = from ?? (document.activeElement === document.body ? null : document.activeElement)
  if (at) {
    const r = at.getBoundingClientRect()
    root.style.setProperty("--ot-appearance-x", `${r.left + r.width / 2}px`)
    root.style.setProperty("--ot-appearance-y", `${r.top + r.height / 2}px`)
  } else {
    root.style.removeProperty("--ot-appearance-x")
    root.style.removeProperty("--ot-appearance-y")
  }
  const apply = () => {
    for (const k of ["mode", "scheme", "key", "pair"] as const) {
      const v = next[k]
      if (v && !(k === "scheme" && v === "cotton") && !(k === "pair" && v === "parma")) root.dataset[k] = v
      else delete root.dataset[k]
    }
    if (wanted === next) want(null)
  }
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches
  // A control can ask for its own scene change (the mode toggle's data-scene): it becomes the transition's type.
  const scene = at?.getAttribute("data-scene")
  const mine = ++turn
  const go = () => {
    if (mine !== turn) return
    if (still || !("startViewTransition" in document)) apply()
    else if (scene) {
      try { document.startViewTransition({ update: apply, types: [scene] }) }
      catch { document.startViewTransition(apply) } // ponytail: browsers without types get the house circle
    } else document.startViewTransition(apply)
  }
  // Faces already here (or a pair the page has no faces for) turn the page at once.
  const missing = faces(next.pair).filter((f) => !document.fonts.check(f))
  if (!missing.length) go()
  else {
    want(next)
    const loaded = Promise.all(missing.map((f) => document.fonts.load(f))).catch(() => {})
    void Promise.race([loaded, new Promise((done) => setTimeout(done, WAIT))]).then(go)
  }
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)) } catch {} // private mode: the choice lasts the visit
}

/** The appearance on <html>, and a setter that takes a patch and the control it came from. */
function useAppearance() {
  const now = parse(React.useSyncExternalStore(subscribe, snapshot, () => ""))
  const set = (patch: AppearanceValue, from?: Element | null) => applyAppearance({ ...now, ...patch }, from)
  return [now, set] as const
}

/** The choice as one sentence: "Cotton, in ultramarine, set in Archivo and Bodoni." Yours in the italic. */
function sentence({ scheme = "cotton", key, pair = "parma" }: AppearanceValue) {
  const words = PAIRS.find((p) => p.value === pair)?.words ?? pair
  return { scheme: scheme[0].toUpperCase() + scheme.slice(1), key: key ?? OWN[scheme] ?? "its own colour", pair: words }
}

type AppearanceProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** The appearance, when you hold it. Leave it out and the control reads and writes <html> and keeps the choice. */
  value?: AppearanceValue
  /** Called with the whole appearance after every change, and the element that made it. */
  onValueChange?: (value: AppearanceValue, from: Element | null) => void
}

/**
 * Choose the look: scheme, key and pair as three lists of picks, and the answer written back above them as one
 * sentence, "Cotton, in ultramarine, set in Archivo and Bodoni.", which the night toggle finishes: "Read by light."
 * Yours in the italic. On its own it writes the four switches on <html>, keeps them under 0nlytype-theme, and the new page
 * opens as a circle from whatever you touched.
 */
function Appearance({ value, onValueChange, className, ...props }: AppearanceProps) {
  const [page, setPage] = useAppearance()
  const now = value ?? page
  const change = (patch: AppearanceValue, from: Element | null = null) => {
    if (value === undefined) setPage(patch, from)
    onValueChange?.({ ...now, ...patch }, from)
  }
  const said = sentence(now)
  const scheme = now.scheme ?? "cotton"
  const id = React.useId()
  // One accent in view: only the list you're in (or were last in) marks its choice with the accent dot.
  const [at, setAt] = React.useState<"scheme" | "key" | "pair">("scheme")
  const here = (list: typeof at) => ({ "data-here": at === list ? "" : undefined, onFocus: () => setAt(list) })

  return (
    <div data-slot="appearance" className={cn("ot-appearance", className)} {...props}>
      <p className="ot-appearance-answer">
        <output htmlFor={`${id}-scheme ${id}-key ${id}-pair`}>
          <span className="ot-yours">{said.scheme}</span>, in <span className="ot-yours">{said.key}</span>, set in <span className="ot-yours">{said.pair}</span>.
        </output>{" "}
        <ModeToggle variant="sentence" mode={now.mode === "nocturne" ? "nocturne" : "day"} onModeChange={(mode, e) => change({ mode }, e.currentTarget)} />
      </p>
      <div className="ot-appearance-picks">
        <Picks id={`${id}-scheme`} {...here("scheme")} legend="Scheme" value={scheme} onValueChange={(v) => change({ scheme: v })}>
          {SCHEMES.map((s) => <Pick key={s} value={s}>{s}</Pick>)}
        </Picks>
        <Picks id={`${id}-key`} {...here("key")} legend="Key" value={now.key ?? ""} onValueChange={(v) => change({ key: v || undefined })}>
          <Pick value="">
            <PickTitle>its own</PickTitle>
            <PickDescription>{OWN[scheme] ?? "the scheme's"}</PickDescription>
          </Pick>
          {KEYS.map((k) => <Pick key={k} value={k}>{k}</Pick>)}
        </Picks>
        <Picks id={`${id}-pair`} {...here("pair")} onFocus={() => { setAt("pair"); warmPairs() }} onPointerEnter={warmPairs} legend="Pair" value={now.pair ?? "parma"} onValueChange={(v) => change({ pair: v })}>
          {PAIRS.map((p) => (
            <Pick key={p.value} value={p.value}>
              <PickTitle>{p.value}</PickTitle>
              <PickDescription>{p.note}</PickDescription>
            </Pick>
          ))}
        </Picks>
      </div>
    </div>
  )
}

export { Appearance, useAppearance, applyAppearance, warmPairs, APPEARANCE_KEY, SCHEMES, KEYS, PAIRS, type AppearanceProps, type AppearanceValue }
