import type { CSSProperties } from "react"

import { Scrollbar } from "@/registry/0nlytype/ui/scrollbar"
import { State } from "@/components/site/state"

const sections = [
  { id: "overture", num: "I", name: "Overture" },
  { id: "notes", num: "II", name: "Notes" },
  { id: "close", num: "III", name: "Close" },
]

const lines = Array.from({ length: 18 }, (_, i) => `Line ${i + 1} of the brief.`)

const passage = [
  "Everything is type.",
  "The library gives the page two typefaces, and asks it to hold still.",
  "Space does the layout. Type is the only ornament.",
  "One colour marks where you are, and only that.",
  "What you choose is set in the italic; the rest is roman.",
  "Nothing moves unless you do.",
  "A rule appears where there is more, and leaves when there isn't.",
  "The quieter the page, the more each mark on it says.",
]

/** Boxes that scroll, each with a rail as its last child: the ruler (its sections are the headings inside), the numeral and the leaves. */
export default function Example() {
  return (
    <div className="grid items-start gap-x-(--ot-space-8) gap-y-(--ot-space-7) md:grid-cols-2">
      <div className="relative h-56 overflow-auto md:col-span-2">
        <div className="grid max-w-xl gap-[var(--ot-space-4)] pe-[var(--ot-space-6)]">
          <h4 id="overture" className="ot-label">Overture</h4>
          {lines.slice(0, 6).map((l) => <p key={l}>{l}</p>)}
          <h4 id="notes" className="ot-label">Notes</h4>
          {lines.slice(6, 12).map((l) => <p key={l}>{l}</p>)}
          <h4 id="close" className="ot-label">Close</h4>
          {lines.slice(12).map((l) => <p key={l}>{l}</p>)}
        </div>
        <Scrollbar sections={sections} />
      </div>
      <div className="relative h-56 overflow-auto" tabIndex={0} role="region" aria-label="The idea, with the numeral rail">
        <div className="grid gap-[var(--ot-space-4)] pe-[var(--ot-space-8)]">
          {passage.concat(passage).map((l, i) => <p key={i}>{l}</p>)}
        </div>
        <Scrollbar variant="numeral" />
      </div>
      <div className="relative h-56 overflow-auto" tabIndex={0} role="region" aria-label="The idea, with the leaves rail">
        <div className="grid gap-[var(--ot-space-4)] pe-[var(--ot-space-7)]">
          {passage.concat(passage, passage).map((l, i) => <p key={i}>{l}</p>)}
        </div>
        <Scrollbar variant="leaves" />
      </div>
    </div>
  )
}

const pinned = [
  { id: "a", num: "II", name: "Notes", at: 0.2 },
  { id: "b", num: "III", name: "Close", at: 0.45 },
  { id: "c", num: "IV", name: "Credits", at: 0.75 },
]

function Rail({ force, variant }: { force?: string; variant?: "numeral" }) {
  return (
    <div className="relative h-40 w-16">
      <Scrollbar data-force={force} variant={variant} sections={variant ? undefined : pinned} style={{ "--view": variant ? 0.125 : 0.3, "--p": 0.35 } as CSSProperties} />
    </div>
  )
}

/** Leaves are laid by the script, so their states are live boxes: scroll them. */
function Leaves({ label, times }: { label: string; times: number }) {
  return (
    <div className="relative h-40 w-56 overflow-auto" tabIndex={0} role="region" aria-label={label}>
      <div className="grid gap-[var(--ot-space-3)] pe-[var(--ot-space-6)]">
        {Array.from({ length: times }, () => passage).flat().map((l, i) => <p key={i}>{l}</p>)}
      </div>
      <Scrollbar variant="leaves" />
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="Rest"><Rail force="rest" /></State>
      <State label="Pointed at"><Rail force="hover" /></State>
      <State label="Held"><Rail force="active" /></State>
      <State label="Numeral"><Rail force="rest" variant="numeral" /></State>
      <State label="Pointed at"><Rail force="hover" variant="numeral" /></State>
      <State label="Held"><Rail force="active" variant="numeral" /></State>
      <State label="Leaves"><Leaves label="Leaves, a few" times={2} /></State>
      <State label="More leaves than fit"><Leaves label="Leaves, many" times={14} /></State>
    </>
  )
}
