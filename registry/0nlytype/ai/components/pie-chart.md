# 0nlyType: pie-chart

Extracted from DESIGN.md.

### ot-pie (pie-chart)
- Underneath: radial-chart's `Ring`, stacked, plus a hook; the key is native buttons.
- Anatomy: `<figure class="ot-pie" data-variant="ring | horizon" style="--n" aria-label>` holding `.ot-pie-face` (`aria-hidden`) of `.ot-pie-arcs`, one `ot-ring` per share (`head="none"`, its own `from`, `data-shown` on the one the number reads) and one `.ot-pie-tick` per share (`style="--t"`, its arc's middle), then `<figcaption class="ot-pie-read">` (`.ot-pie-value`, a large rolling number, and `.ot-pie-words`: `.ot-pie-name`, `.ot-pie-of`), then `<ul class="ot-pie-key" role="group" aria-label>` of one `<li role="none">` per share, each holding a `<button>` (`.ot-pie-place`, `.ot-pie-key-name`, `.ot-pie-key-value`, and the share in `.ot-sr`).
- ring (the default): "28 December"'s rings. One hairline ring cut into arcs, one per share, clockwise from the top, with a gap of paper between each (a hundredth of the turn, never more than half an arc): no wedges, no fills, and no track under the arcs, so the gaps are the page. Each arc is numbered 01, 02, 03 at its middle, just outside the ring, in the pencil small print and upright; the key under the ring is a contents page of the same numbers, name and figure. The total stands inside as one very large number (weight 200, SPECTRA's scale against the small print) with "visits in all" under it.
- horizon: the Eclipse. The half ring stands on a hairline horizon that runs past it on both sides, and everything else is said below it: the total stands on the line (cap to baseline, so its feet are on it), its words under the line.
- Pointing at an arc (read by its angle, within a finger of the ring) or at its name, or focusing its name, inks that arc in the accent and swells it to three hairlines; the other arcs step back to rule-strong, its number inks, and the total rolls down to its share, "28%" (the sign small and raised; under 1%, "<1"), with the name and "820 of 2,950 visits" under it. Leaving rolls it back up to the total. At rest nothing carries the accent. A changed value glides at andante, as the ring does.
- One share is a whole ring with no gap and no numbers; nothing to share is the bare hairline ring and "0".
- Keyboard: the key is one tab stop (`rove`, round); Up and Down or Left and Right move through the shares and wrap, Home and End jump. Right to left, the arcs, their numbers and the pointer all run counter-clockwise. Screen readers: the figure is named by `label`, the readout is its caption, and each key button reads its name, figure and share of the total. Forced colours: the arcs and their numbers are CanvasText; the pointed arc is told by its weight.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Pie chart (`pie-chart`) | Roll | The pointed arc inks in the accent and swells, the others step back, and the total rolls down to its share and back up to the total |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Pie chart (`pie-chart`) | "28 December" rings; SPECTRA | A ring cut into numbered arcs with paper between them, the total one giant number inside |
| Horizon pie chart (`pie-chart`) | Eclipse | Half a cut ring on a horizon; the total on the line, its words below it |
