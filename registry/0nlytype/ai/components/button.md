# 0nlyType: button

Extracted from DESIGN.md.

### ot-btn (button)
- Underneath: native `<button>`, plus Slot for `asChild`.
- Anatomy: `<button class="ot-btn" data-variant="statement | bracket | quiet | overture | crescendo | stave | ink | space | repeat">` holding `<span class="ot-btn-label" data-text="Label"><span>Label</span></span>` (Button writes the label wrapper; `data-text` is present when the label is plain text). Optional `data-size="l"`.
- One box. Every variant shares the line-height 1.2 and `--py` (0.7em) vertical padding, and centres its label, so the family stands at one height on one baseline: 2.6em, which is also a 44px target at the base size. Bracket's parentheses are drawn outside the flow so the label alone sets the baseline. Focus is the one accent ring (`--ot-stroke`, 4px offset) on every variant.
- Nothing moves its neighbours. The label reserves its widest state: `.ot-btn-label::after` is an invisible copy set at the hover weight and width (`--w-on`, `--s-on`) sharing the label's grid cell, so the button is always as wide as its widest state and the letters swell inside it. Everything else that moves (corners, parentheses, the hairpin, the dot, the staves, the ink) is absolute or transformed. If the label holds elements rather than text, there is no copy and the swell isn't reserved.
- The family. Statement: reversed type in an ink block, one per view. On hover the letters widen (`font-stretch` to 114%, inside the reserved width) and corner marks close in (`ot-corners`), landing with spiccato. Pressed, it drops 1px and the corners clasp. Bracket: `( Label )`; the parentheses step apart on hover and close in on press. Quiet: a hairline underline that retracts and redraws at stroke width. Both lines are transitions, so leaving part-way rewinds from where they are: the stroke goes back to the start and the hairline returns behind it. Pressed, it drops 1px.
- The heroes, for the big call to action; all type-led, and each steps down one size on a phone.
  - Overture: light (200) type that swells to heavy (800) as you come to it; the accent full stop that follows the word (its room is always reserved) lands with spiccato. Pressed, the weight settles at 560. Size `m` is the `mf` step, `l` is `f`.
  - Crescendo: the hairpin that says "grow louder". At rest it is barely open (0.16em), a pencil sign under the word; closed flat, it read as an empty field's line. Pointing opens them across the word and inks them, and the word swells a weight (450 to 600, inside the reserved width). Pressed, the hairpin opens wide in the accent. The hairpin is an image mask, so its lines stay one hairline however far it opens, and it mirrors in right-to-left.
  - Stave: the word in the expression italic (it is a term) between two staves of five hairlines that never cross it. At rest each stave is a short stub beside the word; pointing runs them out to the button's edges (mirrored right to left); pressed, they draw in.
  - Ink: an outlined hairline block. Pointing fills it with ink from the side the pointer came in (`data-edge`, set on pointer enter and leave, so the ink also leaves toward the side you go) and the words reverse to paper. With no pointer (keyboard) the ink comes from the inline start, so it mirrors right to left.
- The measures, for actions that live in a line of their own.
  - Space: after the bottom line of "It has to be design." ("→ Watch this space.") and the Renaissance poster's spread top row. The words, in tracked capitals, spread across the whole line: the button is as wide as its container and the spaces between the words take the room (`.ot-btn-gap`, real spaces, so the name reads as one phrase). Pointing or focusing closes the spaces, the phrase gathers at the line's end, and the silence it leaves becomes a hairline arrow leading to it (`.ot-btn-lead`, which grows as the gaps shrink: `flex-grow` on both). Pressed, the arrowhead steps forward. The arrow mirrors right to left. A label that holds elements rather than text keeps the ordinary label and doesn't spread.
  - Repeat: the word between repeat signs, a thick and a thin bar at each end (one layer of four gradients on `::before`). At rest only the closing sign has its dots (`::after`), which in a score already means "go back to the beginning". Pointing inks the bars and sets the opening dots (`.ot-btn-label::before`), landing with spiccato, so the passage is framed to go round; pressed, they settle. For Try again, Replay, Start over.
- States: rest, hover, focus (accent outline; the heroes and the measures also show their hover on `:focus-visible`), disabled (pencil; the block or outline goes to the rule; no hover), busy (`aria-busy="true"` plus the doing word and `ot-dots`; no hover, progress cursor). Forced colours: the blocks get a `ButtonText` border, and the ink and dots use `Highlight`.
- Keyboard: native button.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Statement button (`button`) | Accent (a pressed note) | Hover widens it; press makes it heavier and narrower, and the corners clasp |
| Bracket button (`button`) | Spiccato | The parentheses step apart and rebound |
| Quiet button (`button`) | Pass-through | The line leaves to the right and redraws from the left |
| Space button (`button`) | Gather | The spaces close, the phrase gathers at the end and the arrow draws in behind it; pressed, the head steps on |
| Repeat button (`button`) | Pencil, then ink | The bars ink and the opening dots land with spiccato |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Statement button (`button`) | "the silence that heals" corners | Corner marks close in on hover |
| Space button (`button`) | "It has to be design." ("Watch this space."); the Renaissance top row | The words spread across the line; gathered, the silence they leave becomes the arrow |
| Repeat button (`button`) | The score's repeat signs | The word between repeat bars; the opening dots set it to go round |
