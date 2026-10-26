"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { useAppearance, warmPairs, KEYS, PAIRS, SCHEMES, type AppearanceValue } from "@/registry/0nlytype/ui/appearance"
import { ModeToggle } from "@/registry/0nlytype/ui/mode-toggle"
import { Button } from "@/registry/0nlytype/ui/button"

// The site's names for the library's appearance, which the landing page's tuning sentence also uses.
export { KEYS, PAIRS, SCHEMES, warmPairs, useAppearance as useTheme, type AppearanceValue as Theme }

// The popover loads when someone reaches for Tune, as search does, so no page carries it before it's wanted.
const TunePanel = dynamic(() => import("./tune-panel").then((m) => m.TunePanel))

/** The day and night toggle, and Tune: the library's appearance in a popover. */
export function ThemeControls() {
  const [theme, set] = useAppearance()
  const [open, setOpen] = React.useState(false)
  const [requested, setRequested] = React.useState(false)
  const button = React.useRef<HTMLButtonElement>(null)
  // Reaching for Tune starts the other pairs' fonts and the panel, so it opens already set in them.
  const reach = () => { warmPairs(); setRequested(true) }
  return (
    <div className="bar-controls">
      <Button ref={button} variant="quiet" aria-haspopup="dialog" aria-expanded={open} onPointerEnter={reach} onFocus={reach} onClick={() => { setRequested(true); setOpen((o) => !o) }}>
        Tune
      </Button>
      {requested ? <TunePanel anchor={button} open={open} onOpenChange={setOpen} /> : null}
      {/* The toggle reports; its data-scene tells the appearance hook which scene change to draw. */}
      <ModeToggle variant="dimmer" aria-label="Night mode" mode={theme.mode === "nocturne" ? "nocturne" : "day"} onModeChange={(m, e) => set({ mode: m }, e.currentTarget)} className="bar-mode" />
    </div>
  )
}
