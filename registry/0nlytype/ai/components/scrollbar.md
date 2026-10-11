# 0nlyType: scrollbar

Extracted from DESIGN.md.

### ot-scrollbar (scrollbar)
- Underneath: hook (`useScrollbar`).
- Anatomy: `<div class="ot-scrollbar" aria-hidden="true"><span class="ot-scrollbar-thumb"></span></div>` placed anywhere inside a scroller (it finds the nearest one around it: a cmdk list keeps it inside its sizer). `data-axis="x"` runs it along the bottom of a box that scrolls sideways (right-to-left reverses it: `--dir`). `data-variant="page"` fixes it to the window's inline end instead, and takes one `<span class="ot-scrollbar-mark" data-num data-name style="--at; --i">` per section. `data-variant="numeral"` and `data-variant="leaves"` are inner rails with another look (down the side only); leaves adds `<span class="ot-scrollbar-leaves">`, which the script fills with one `<span class="ot-scrollbar-leaf" data-leaf="3/7">` per disc.
- Script sets `--view` (the share in view, with a thumb of at least `min` px), `--max` (how far the box scrolls), `--dir`, `data-idle` when there's nothing to scroll, then `data-ready`; it then marks the host `data-scrollbar-host` (`="pin"` when it also had to be given `position: relative`) and, while there is something to scroll, `data-lenis-prevent`. It re-measures on resize and on any change inside the box, including its content growing or a disclosure opening; scrolling uses the saved measurements. It turns on only for a fine pointer with scroll timelines; otherwise the thin native stroke stays.
- The site has one page rail, in the root layout (`PageRail`, which is `ReadingTrail variant="rail"`): elements with an `id` and `data-rail="Name"` become its marks, numbered in order.
- A ruler: a hairline and an ink thumb as long as the view. Inside a scroller, the rail is pinned by the scroller's own timeline (`animation-timeline: scroll(nearest)`, translating by `--max`), so it stays on the edge with no script running while you scroll. The thumb rides the same timeline. On the page, a mark shows where each section begins, and the current one is ink (`data-now`).
- Pointing sketches: pointing at a scroller darkens its rail; pointing at the rail thickens the thumb, and on the page the numbers arrive down the rail in turn, with a mark's name when you point at it. Holding the thumb (`data-dragging`) inks it in the accent, because it marks where you are.
- Pointer only: pressing a page mark goes to its section, pressing the rail centres the thumb there, and the thumb drags. Pressing doesn't move focus, so an open list stays open. The keyboard scrolls as always, which is why the rail is hidden from assistive technology.
- Down the side of a box, a mark's number leans into the box as its mark nears the top or bottom (by `--at`), so the first is never cut off by the box's top edge; the page's rail is tall enough not to.
- Numeral, after "the silence that heals" (14 / 08), where numbers are the data: the thumb is a figure, how far down you are from 00 to 100 (`decimal-leading-zero`, tabular, `--ot-p`), riding the hairline on a 0.375rem ink dot. It counts through every number as the box scrolls: a counter on a registered `--ot-scrollbar-read` that the scroller's own timeline drives, so it keeps time with smooth scrolling and needs no script while you scroll. At rest the figure is pencil; pointing inks it and swells the dot; holding (or dragging it) puts both in the accent. The rail is 3.25rem wide. Section marks work as on the ruler.
- Leaves, after the "Less but better" calendar (gone, today, to come): no thumb, but a disc for every screenful (a leaf) of the box, stacked down from the top of the rail, 0.625rem on a 1.125rem step. Those you've read are ink (`data-read`), the one you're on is the one accent (`data-now`), those to come are hairline rings. When they won't fit down the rail, a disc holds as many leaves as it must. Script lays them on resize and change and marks them on scroll. Pointing at a disc swells it and names its place ("3/7"); pressing it turns the box to that leaf (smooth, at once with reduced motion).
- Forced colours: the rail keeps its own colours (`forced-color-adjust: none`), remapped to CanvasText, GrayText and Highlight, because the thumb, the dot and the discs are drawn as backgrounds.
- Once the rail is running, the host's own bar is gone (`scrollbar-width: none` on `[data-scrollbar-host]`). Without the rail (touch, or before the script) every scroller gets a thin stroke on a clear track (`scrollbar-color` from `:root`, `scrollbar-width: thin`) that darkens from rule to pencil when pointed at; Safari, which lacks `scrollbar-color`, gets a hairline thumb that thickens.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Scrollbar (`scrollbar`) | Arpeggio, then ink | The numbers arrive down the rail; held, the thumb takes the accent |
| Numeral scrollbar (`scrollbar`) | Count | The figure counts through every number as you scroll; held, it takes the accent |
| Leaves scrollbar (`scrollbar`) | Ink | The disc you reach takes the accent and the one you leave sets to ink |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Scrollbar (`scrollbar`) | Paul Rand dimension lines | The page as a ruler, marked at each movement |
| Numeral scrollbar (`scrollbar`) | "the silence that heals" (14 / 08) | The thumb is a figure: how far down you are |
| Leaves scrollbar (`scrollbar`) | "Less but better" calendar | A disc a screenful: read in ink, here in the accent, to come in rings |
