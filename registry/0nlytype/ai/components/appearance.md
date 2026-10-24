# 0nlyType: appearance

Extracted from DESIGN.md.

### ot-appearance (appearance)
- Underneath: native, through `picks` and `mode-toggle`, plus a hook that reads and writes the four switches on `<html>`.
- Anatomy: `<div class="ot-appearance">` holding `<p class="ot-appearance-answer"><output>…</output> <button class="ot-mode" data-variant="sentence">…</button></p>` and `<div class="ot-appearance-picks">` with three `ot-picks` (pizzicato): Scheme (cotton, blueprint, statue, silence, riso), Key ("its own", its description naming the scheme's own accent, then ultramarine, viridian, ember, violet) and Pair (parma, press, paris, salon, each with its faces as the description).
- The move, after "Healthy habits → for creatives", where the voice runs into the italic on one line of thought: the choice is written back as one sentence over the lists, "Cotton, in ultramarine, set in Archivo and Bodoni.", and the night toggle finishes it, "Read by light." Ours in roman and graphite; yours, the three words you chose, in the italic and ink. The sentence is an `<output>` for the three lists, so a reader hears the new sentence after each choice. No key reads the scheme's own accent by name (cotton ultramarine, blueprint orange, statue gold, silence cobalt, riso magenta).
- Layout: the lists stand two across with the pair under them, or three across once the control is 36rem wide (a container query); the answer steps up from `--ot-mp` to `--ot-mf` there. The picks are set at `--ot-p`, closer than a standalone list. One accent in view: only the list you're in, or were last in (`data-here`, the scheme to begin with), marks its choice with the accent dot; the others set theirs in ink, and their italic titles still say what's chosen.
- It writes only the four switches (`data-mode`, `data-scheme`, `data-key`, `data-pair`; cotton and parma are no attribute) and keeps them together as one JSON object under `0nlytype-theme` in localStorage. `useAppearance()` reads `<html>` through a MutationObserver, so a head script, the page and every control agree. With `value` it holds nothing and writes nothing: `onValueChange(value, from)` reports.
- Motion: the new appearance opens over the old as a circle from the control you touched (a view transition, andante, exhale, so the circle is already wide as the press lands; `--ot-appearance-x`, `--ot-appearance-y` on `<html>`). Under the circle the colours are already new, so the body's own colour fade is off for as long as the transition runs (`:active-view-transition`). Reduced motion, or no view transitions, changes it at once, and there the body's colour fade stays.
- Faces: a pair's fonts load only when the page first asks for them. Pointing at or focusing the pair list fetches every pair's faces (`warmPairs()`), and choosing a pair whose faces have not arrived waits up to 400ms for them before the page turns, so the new page opens already set in its letters. The control shows the choice at once while it waits; a second change made meanwhile builds on it. The page restores the stored choice before first paint with a one-line script in `<head>` (the docs site's `theme-script.tsx`).
- States: those of picks and the mode toggle. Keyboard: Tab through the toggle and the three groups; arrow keys move each choice.
- The site's bar opens it from Tune, in a popover, beside the dimmer toggle.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Appearance (`appearance`) | Opening | The new page opens over the old as a circle from the control you touched |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Appearance (`appearance`) | "Healthy habits → for creatives"; the score's pizzicato (picks) | The choice written back as one sentence, yours in the italic; the night toggle finishes it |
