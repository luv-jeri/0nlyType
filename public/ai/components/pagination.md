# 0nlyType: pagination

Extracted from DESIGN.md.

### ot-pager (pagination)
- Underneath: native links. The current page is a link with `aria-current="page"`; a step with nowhere to go is a `<span aria-disabled="true">`, in rule-strong.
- Anatomy: `<nav aria-label="Pages">` holding `<ul class="ot-pager" data-variant="numbers | folio | neighbours | barcode | thumb">` of `<li>`, each a page link (two-digit numbers), a step (`.ot-pager-step`, the arrow drawn in CSS with empty alt text), or a gap (`.ot-pager-gap`, read as "More pages").
- numbers (the default): a 3px dot sits under each number; the current page's dot is 6px and in the accent, and it lands with spiccato. Pointing at another page draws a hairline ring there.
- Weight falls with distance (600, then 350 for the neighbours, then 200), after the WOVE poster. Colour never drops below pencil, so contrast holds at AA.
- Long runs: `paginationRange(current, total, siblings = 1)` gives the ends, the current page and its siblings, and a gap for each run left out, always in the same number of slots (siblings * 2 + 5). A gap has the same outer width as a two-digit page link, two figures plus 7px padding on each side, and never stands for a single page, so paging moves nothing beside the pager.
- Below 40rem the numbers drop a size to `p`, use a space-1 gap between the padded targets, and the steps keep only their arrows (their words stay for screen readers), so a long run holds one line on a phone. Number links and steps keep a minimum 24px target width.
- folio: the current page over the total, as a book sets its folio. The number stands in ink at 600 on its accent dot; a leaning hairline that thins at both ends (the fraction's pen stroke); then the total small, upright and a little wide, in graphite. The total is plain, aria-hidden text; the current page's name carries it ("Page 7 of 24"). The steps are arrows alone. It mirrors in RTL, stroke and all.
- neighbours: the pages either side, by name, at the two ends of the line: a small word ("Previous", "Next", at `pp` 500 in graphite) over the name at `mf` 300 in ink, hung on a hairline arrow as the notes are in "It has to be design." (the arrow input group's drawn shaft and open head, `space-6` long, pointing the way the step goes and mirrored in RTL). There's no current page in view, so no accent. Pointing thickens the name to 450 at moderato, as nearness does in the numbers, inks the word and the arrow, and steps the arrow `space-1` its way. A step with nowhere to go is left out.
- barcode: every page a hairline, SPECTRA's barcode read the way the dot calendar reads its days: the pages behind you in ink, the pages ahead in pencil, yours a 3px line in the accent, 26px tall to the others' 16, with its number set small (`pp` 600, ink) above it. The other numbers are there, transparent, for their names ("Page 9 of 24"); pointing at or focusing a line lifts it to 22px in graphite and shows its number in place of yours, so one number is ever in view. The lines share the nav's width, at most `space-4` apart and at least `space-2`; the steps are arrows alone. Every page is a link, so Tab walks the run; it suits runs up to about 40.
- thumb: a dictionary's thumb index set the way "the uncreative" sets its word: the alphabet as one heavy (700), tight word at `mf`, the current letter reversed out of an accent block in paper. Letters with nothing under them stay in the word, thin (200) and pencil, as an aria-hidden item that isn't a link. Pointing sketches the block in rule; choosing inks it in the accent. Each letter is at least 24px wide; below 40rem the word breaks in two rows of 13, so every letter stays a wide enough target.
- Forced colours: the dots and lines are drawn in CanvasText and GrayText, the current one in Highlight; the thumb's block is Highlight with HighlightText.
- Keyboard: Tab through the links; Enter follows. Pagers that turn in place (the example) keep focus in the pager when a step runs out, on the current page.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Pager (`pagination`) | Pencil, then ink | A ring on hover; the accent dot lands |
| Neighbours pager (`pagination`) | Legato | The name thickens as you point; the word inks and the arrow steps its way |
| Barcode pager (`pagination`) | Spiccato | The line you point at lifts and its number takes the place of yours |
| Thumb pager (`pagination`) | Pencil, then ink | Pointing sketches the block in rule; the chosen letter is reversed out of the accent |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Pager (`pagination`) | WOVE | Weight falls with distance |
| Folio pager (`pagination`) | A book's folio; the fraction | The page over the total, on a leaning stroke |
| Neighbours pager (`pagination`) | End-of-chapter pages; "It has to be design." notes on hairline arrows | The pages either side, named at the two ends, each hung on an arrow |
| Barcode pager (`pagination`) | SPECTRA's barcode; "28 December" dots | Every page a line: behind in ink, ahead in pencil, yours in the accent |
| Thumb pager (`pagination`) | A dictionary's thumb index; "the uncreative" | The alphabet as one word, the current letter reversed out |
