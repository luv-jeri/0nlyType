# 0nlyType: carousel

Extracted from DESIGN.md.

### ot-carousel (carousel)
- Underneath: scroll snap, plus a hook.
- Anatomy: `<div class="ot-carousel" data-variant="poster | line | shelf" role="region" aria-roledescription="carousel">` holding `.ot-carousel-track` (scroll-snap, `tabindex="0"`) of `.ot-carousel-slide` (`role="group"`, "n of m", `data-current` on the one you're on) with `.ot-carousel-title`, then `.ot-carousel-nav` with ← and → buttons around `.ot-carousel-count` (`.ot-carousel-now`). On the shelf each closed slide also holds `.ot-carousel-spine`, a button over it.
- One poster at a time, each name set so large it is cropped: it sinks under a hairline that cuts off its feet, the way SPECTRA's rule crops its word, and a name wider than the frame runs off its end. The count rolls the way you travel; the slide whose start edge is nearest the track's start is the one you're on, read on scroll, so it stays true while you swipe.
- Line: every name runs on as one line of display type, each closed by a full stop, and you read along it. The name at the start is the one you're on: it inks, its full stop takes the accent and its facts appear under it; the rest wait in pencil, the next one cropped by the frame's end. A spacer after the last name lets it, too, come to the start, the end of the line. Forced colours set the waiting names in GrayText.
- Shelf: the slides stand as spines, a hairline between each, their names running up them in the pencil like books on a shelf (the sheet's spine, made a whole shelf). The one you take out widens and turns to face you, its name sinking under its hairline and cropped by the next spine; the one you put back narrows into a spine. The track doesn't scroll. Pointing at a spine inks its name; clicking takes it out.
- Keyboard: Left and Right on the track, Home and End, or the buttons. Keys in inputs, textareas, selects and editable text stay with those controls; a key already handled by a slide stays handled. The spines are pointer targets only (`tabindex="-1"`): the keyboard has the track and the buttons.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Carousel (`carousel`) | Roll | The count rolls the way you travel |
| Line carousel (`carousel`) | Reading on | The line slides; the name arriving at the start inks, its full stop takes the accent and its facts appear, while the one you left goes back to pencil |
| Shelf carousel (`carousel`) | Taken out | The spine widens and its name turns to face you; the other narrows back into a spine |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Carousel (`carousel`) | POINT / SPECTRA | One poster at a time, the name sunk under a hairline |
| Line carousel (`carousel`) | "It has to be design." (the accent full stop); SPECTRA crop | The names as one line of type, read along |
| Shelf carousel (`carousel`) | Books on a shelf | Spines with the names running up them; one taken out faces you |
