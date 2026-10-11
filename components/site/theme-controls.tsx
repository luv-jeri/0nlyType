"use client"

import { Appearance, useAppearance, warmPairs, KEYS, PAIRS, SCHEMES, type AppearanceValue } from "@/registry/0nlytype/ui/appearance"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/0nlytype/ui/popover"
import { ModeToggle } from "@/registry/0nlytype/ui/mode-toggle"
import { Button } from "@/registry/0nlytype/ui/button"

// The site's names for the library's appearance, which the landing page's tuning sentence also uses.
export { KEYS, PAIRS, SCHEMES, warmPairs, useAppearance as useTheme, type AppearanceValue as Theme }

/** The day and night toggle, and Tune: the library's appearance in a popover. */
export function ThemeControls() {
  const [theme, set] = useAppearance()
  return (
    <div className="bar-controls">
      <Popover>
        {/* Reaching for Tune starts the other pairs' fonts, so a pair chosen inside opens already set in them. */}
        <PopoverTrigger asChild>
          <Button variant="quiet" onPointerEnter={warmPairs} onFocus={warmPairs}>Tune</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="tune">
          <Appearance />
        </PopoverContent>
      </Popover>
      {/* The toggle reports; its data-scene tells the appearance hook which scene change to draw. */}
      <ModeToggle variant="dimmer" aria-label="Night mode" mode={theme.mode === "nocturne" ? "nocturne" : "day"} onModeChange={(m, e) => set({ mode: m }, e.currentTarget)} className="bar-mode" />
    </div>
  )
}
