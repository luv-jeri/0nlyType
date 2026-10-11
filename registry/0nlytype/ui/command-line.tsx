"use client"

import * as React from "react"

import { cn } from "@/registry/0nlytype/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/registry/0nlytype/ui/radio-group"
import { CopyButton } from "@/registry/0nlytype/ui/source"

/** What runs a package without installing it, per package manager. */
const RUNNERS = { npm: "npx", pnpm: "pnpm dlx", yarn: "yarn", bun: "bunx --bun" } as const
type Runner = keyof typeof RUNNERS
const STORE = "0db-runner"

// Every command line on the page shares one choice, and the next visit remembers it.
let chosen: Runner | undefined
const heard = new Set<() => void>()
const isRunner = (v: unknown): v is Runner => typeof v === "string" && v in RUNNERS
function current(): Runner {
  if (chosen) return chosen
  try {
    const stored = localStorage.getItem(STORE)
    if (isRunner(stored)) return stored
  } catch {} // private mode: the choice lasts the visit
  return "npm"
}
function subscribe(notify: () => void) {
  heard.add(notify)
  addEventListener("storage", notify)
  return () => {
    heard.delete(notify)
    removeEventListener("storage", notify)
  }
}
function choose(next: Runner) {
  chosen = next
  try {
    localStorage.setItem(STORE, next)
  } catch {}
  heard.forEach((notify) => notify())
}

type CommandLineProps = Omit<React.ComponentProps<"figure">, "children"> & {
  /** The command, without a runner when `runner` is set: "shadcn@latest add https://…/button.json". */
  command: string
  /** Run it through a package manager the reader picks (npx, pnpm dlx, yarn, bunx). The pick is shared and remembered. */
  runner?: boolean
  /** The part that's the reader's, set in italic: an item's name inside a URL. */
  emphasis?: string
  /**
   * line (the default): one line on a baseline. parsed: each word glossed beneath in small type, on a short
   * rule under the word. synopsis: the emphasis is a blank the reader fills in, and Copy copies what they wrote.
   */
  variant?: "line" | "parsed" | "synopsis"
  /** parsed: a gloss for each word of the command, in order; leave one empty to skip that word. */
  glosses?: string[]
  /** synopsis: names the blank for assistive tech, e.g. "Item name". */
  blank?: string
}

/**
 * One line to type, set on a baseline like a field already filled in. The runner and the address
 * recede to pencil; the words that matter are ink, and the part that's yours is italic.
 * Copying draws the baseline in the accent.
 */
function CommandLine({ command, runner = false, emphasis, variant = "line", glosses, blank = "Your part", className, ...props }: CommandLineProps) {
  const pick = React.useSyncExternalStore(subscribe, current, () => "npm" as Runner)
  const prefix = runner ? `${RUNNERS[pick]} ` : ""
  const [copied, setCopied] = React.useState(0)
  const [filled, setFilled] = React.useState(emphasis ?? "")
  const synopsis = variant === "synopsis" && !!emphasis
  const typed = synopsis ? command.replace(emphasis!, filled.trim() || emphasis!) : command
  const yours = (part: string) =>
    synopsis ? (
      <input
        className="ot-command-line-blank"
        aria-label={blank}
        value={filled}
        placeholder={part}
        size={Math.max(filled.length, part.length, 1)}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        onChange={(e) => setFilled(e.target.value.replace(/\s/g, ""))}
      />
    ) : (
      <em className="ot-command-line-yours">{part}</em>
    )
  const parsed = variant === "parsed" && glosses?.length
  return (
    <figure data-slot="command-line" data-variant={variant} className={cn("ot-command-line", className)} {...props}>
      {runner ? (
        <RadioGroup aria-label="Package manager" className="ot-command-line-runners" value={pick} onValueChange={(v) => isRunner(v) && choose(v)}>
          {(Object.keys(RUNNERS) as Runner[]).map((r) => (
            <RadioGroupItem key={r} value={r}>
              {r}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      ) : null}
      <div data-copied={copied ? (copied % 2 ? "a" : "b") : undefined} className="ot-command-line-row">
        <code data-slot="command-line-text" className="ot-command-line-text" dir="ltr">
          {prefix ? <span className="ot-command-line-quiet">{prefix}</span> : null}
          {words(command, emphasis, yours, parsed ? glosses : undefined)}
        </code>
        {parsed ? (
          <span className="ot-sr">
            {command
              .split(/\s+/)
              .map((w, i) => (glosses[i] ? `${w}: ${glosses[i]}` : ""))
              .filter(Boolean)
              .join(". ")}
          </span>
        ) : null}
        <CopyButton text={prefix + typed} onCopied={() => setCopied((c) => c + 1)} />
      </div>
    </figure>
  )
}

/** Addresses recede, all but the emphasis; a long one breaks after a slash. */
function words(command: string, emphasis: string | undefined, yours: (part: string) => React.ReactNode, glosses?: string[]) {
  let n = -1
  return command.split(/(\s+)/).map((word, i) => {
    if (/^\s+$/.test(word)) return <React.Fragment key={i}>{word}</React.Fragment>
    n++
    const set = address(word, emphasis, yours)
    // parsed: the word stands over a short rule, its gloss hung beneath (aria-hidden; the list is read after).
    if (glosses?.[n])
      return (
        <span key={i} className="ot-command-line-word">
          <span className="ot-command-line-said">{set}</span>
          <span className="ot-command-line-gloss" aria-hidden="true">
            {glosses[n]}
          </span>
        </span>
      )
    return <React.Fragment key={i}>{set}</React.Fragment>
  })
}

function address(word: string, emphasis: string | undefined, yours: (part: string) => React.ReactNode) {
  const at = emphasis ? word.lastIndexOf(emphasis) : -1
  if (!/^[a-z]+:\/\//.test(word)) {
    if (at < 0) return word
    return (
      <>
        {word.slice(0, at)}
        {yours(emphasis!)}
        {word.slice(at + emphasis!.length)}
      </>
    )
  }
  const before = at < 0 ? word : word.slice(0, at)
  return (
    <span className="ot-command-line-quiet">
      {breakable(before)}
      {at < 0 ? null : (
        // The name and what follows it (".json") hold together: no line starts with ".json" or "card".
        <span className="ot-command-line-whole">
          {yours(emphasis!)}
          {word.slice(at + emphasis!.length)}
        </span>
      )}
    </span>
  )
}

// A break may follow a slash, but never falls inside "//".
const breakable = (s: string) =>
  s.split(/(?<=\/)(?!\/)/).map((part, i) => (
    <React.Fragment key={i}>
      {i ? <wbr /> : null}
      {part}
    </React.Fragment>
  ))

export { CommandLine, type CommandLineProps }
