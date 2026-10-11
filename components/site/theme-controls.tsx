"use client"

import { Appearance, useAppearance, KEYS, PAIRS, SCHEMES, type AppearanceValue } from "@/registry/0nlytype/ui/appearance"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/0nlytype/ui/popover"
import { ModeToggle } from "@/registry/0nlytype/ui/mode-toggle"
import { Button } from "@/registry/0nlytype/ui/button"

// The site's names for the library's appearance, which the landing page's tuning sentence also uses.
export { KEYS, PAIRS, SCHEMES, useAppearance as useTheme, type AppearanceValue as Theme }

/** The day and night toggle, and Tune: the library's appearance in a popover. */
export function ThemeControls() {
  const [theme, set] = useAppearance()
  return (
    <div className="bar-controls">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="quiet">Tune</Button>
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
