"use client"

import * as React from "react"

import { Appearance } from "@/registry/0nlytype/ui/appearance"
import { Popover, PopoverAnchor, PopoverContent } from "@/registry/0nlytype/ui/popover"

/**
 * Tune's panel: the library's appearance in a popover, held to the bar's own Tune button. It loads the first time
 * someone reaches for Tune (theme-controls.tsx), so the popover's code never rides on a page's first load.
 */
export function TunePanel({ id, anchor, open, onOpenChange }: { id: string; anchor: React.RefObject<HTMLButtonElement | null>; open: boolean; onOpenChange: (open: boolean) => void }) {
  const restoreFocus = React.useRef(true)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchor as React.RefObject<HTMLButtonElement>} />
      <PopoverContent
        id={id}
        align="end"
        className="tune"
        // The button is the trigger in all but name: pressing it again closes the panel, rather than closing and reopening it.
        onOpenAutoFocus={() => { restoreFocus.current = true }}
        onEscapeKeyDown={() => { restoreFocus.current = true }}
        onInteractOutside={(e) => {
          if (anchor.current?.contains(e.target as Node)) e.preventDefault()
          else restoreFocus.current = false
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          if (restoreFocus.current) anchor.current?.focus({ preventScroll: true })
        }}
      >
        <Appearance />
      </PopoverContent>
    </Popover>
  )
}
