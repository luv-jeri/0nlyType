"use client"

import * as React from "react"

import { Button } from "@/registry/0nlytype/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandHint,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/registry/0nlytype/ui/command"
import { Kbd } from "@/registry/0nlytype/ui/kbd"
import { State, Still } from "@/components/site/state"

const PROJECTS = [
  ["Halden", "Identity, 2026"],
  ["Northlight", "Web, 2026"],
  ["Oda Studio", "Identity, 2025"],
  ["Tidewater", "Motion, 2025"],
  ["Marram", "Web, 2025"],
]

function Palette({ onRun, whole }: { onRun: (said: string) => void; whole?: boolean }) {
  return (
    <>
      <CommandInput placeholder="Type to search" />
      <CommandList style={whole ? { maxHeight: "none" } : undefined}>
        <CommandEmpty>Nothing matches. Try a project, like Halden.</CommandEmpty>
        <CommandGroup heading="Projects">
          {PROJECTS.map(([name, hint]) => (
            <CommandItem key={name} value={name} keywords={[hint]} onSelect={() => onRun(`Opened ${name}.`)}>
              {name}
              <CommandHint>{hint}</CommandHint>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem value="Start a project" onSelect={() => onRun("Started a new project.")}>Start a project</CommandItem>
          <CommandItem value="Show the grid" keywords={["layout"]} onSelect={() => onRun("Showed the grid.")}>
            Show the grid
            <CommandShortcut>G</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  )
}

/** The palette opens from the button or from ⌘K / Ctrl+K; the key is registered here, not in the item. */
export default function Example() {
  const [open, setOpen] = React.useState(false)
  const [said, setSaid] = React.useState("")
  const still = React.useContext(Still)
  React.useEffect(() => {
    if (still) return
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [still])
  return (
    <div className="grid w-full max-w-[40rem] justify-items-stretch" style={{ gap: "var(--ot-space-8)" }}>
      <div className="flex flex-wrap items-center" style={{ gap: "var(--ot-space-5)" }}>
        <Button variant="bracket" onClick={() => setOpen(true)}>
          Search <Kbd>⌘K</Kbd>
        </Button>
        <p aria-live="polite">{said}</p>
      </div>
      <div className="grid" style={{ gap: "var(--ot-space-3)" }}>
        <span className="ot-label">Mesostic</span>
        <Command variant="mesostic" aria-label="Projects and actions, as a mesostic" defaultSearch="ar">
          <Palette onRun={setSaid} whole />
        </Command>
      </div>
      <div className="grid" style={{ gap: "var(--ot-space-3)" }}>
        <span className="ot-label">Index</span>
        <Command variant="index" aria-label="Projects and actions, as an index">
          <Palette onRun={setSaid} whole />
        </Command>
      </div>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search projects and actions">
        <Palette
          onRun={(next) => {
            setSaid(next)
            setOpen(false)
          }}
        />
      </CommandDialog>
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="Headline"><Command aria-label="Commands" className="w-[min(36rem,80vw)]"><Palette onRun={() => {}} whole /></Command></State>
      <State label="Headline, matching “ar”"><Command aria-label="Commands, matching" defaultSearch="ar" className="w-[min(36rem,80vw)]"><Palette onRun={() => {}} whole /></Command></State>
      <State label="Mesostic, “a”"><Command variant="mesostic" aria-label="Commands, a mesostic" defaultSearch="a" className="w-[min(36rem,80vw)]"><Palette onRun={() => {}} whole /></Command></State>
      <State label="Index, “o”"><Command variant="index" aria-label="Commands, an index" defaultSearch="o" className="w-[min(36rem,80vw)]"><Palette onRun={() => {}} whole /></Command></State>
      <State label="Index, nothing matches"><Command variant="index" aria-label="Commands, no match" defaultSearch="qz" className="w-[min(36rem,80vw)]"><Palette onRun={() => {}} whole /></Command></State>
    </>
  )
}
