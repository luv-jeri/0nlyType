"use client"

import { useRouter } from "next/navigation"

import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/registry/0nlytype/ui/command"
import type { SearchGroup } from "./search"

/** The palette is fetched on its first click or keyboard shortcut. */
export function SearchDialog({ groups, open, onOpenChange, onCloseAutoFocus }: { groups: SearchGroup[]; open: boolean; onOpenChange: (open: boolean) => void; onCloseAutoFocus?: (event: Event) => void }) {
  const router = useRouter()
  const go = (href: string) => {
    onOpenChange(false)
    if (href.startsWith("copy:")) navigator.clipboard?.writeText(href.slice(5)).catch(() => {})
    else router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} onCloseAutoFocus={onCloseAutoFocus} title="Search the docs">
      <CommandInput placeholder="Find a component" />
      <CommandList>
        <CommandEmpty>Nothing by that name. Try “menu” or “accent”.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g.heading} heading={g.heading}>
            {g.entries.map((e) => (
              <CommandItem key={e.href} value={`${g.heading} ${e.label}`} keywords={e.keywords} onSelect={() => go(e.href)}>
                {e.label}
                {e.hint ? <span className="search-hint">{e.hint}</span> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
