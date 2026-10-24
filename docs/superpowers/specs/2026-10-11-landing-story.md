# The landing's story: every section after 01, set in type that moves

Owner request, 2026-10-11 (abridged, their words): "revamp the other section as well, similarly we have done for this
transition ... think more creatively and more artistically ... pick the inspiration from [docs/references] and don't go
too out of the board from a philosophy where you want to use the text mostly ... utilize pretext library to create
shapes and animations and transition ... waves, realistic waves, the water effect, the sprinkling effect ... strings and
detailed strings ... any shape, any picture you can convert ... lay down in different angles ... the two colors we have
selected ... scroll trigger things ... complete this website head to toe ... for each and every section, we need to
follow a proper story. If you want to remove the sections, you can remove them ... add a new section ... impress the
person who is watching."

This supersedes spec 2026-10-10-landing-b where they disagree: L9 removed the sea; the owner has asked for waves and
water again, so the sea returns, in 03.

## The story

The page is one sentence told in sections: **everything is in the zero; what's not in it; what it can still do; how
it becomes yours; and back to zero.** Each section shows its claim with type doing something only type could do here.
The reader should be able to scroll it without reading a word and still get the story; reading it adds the reasons.

| # | Section | Claim | What the type does | Poster it comes from |
|---|---|---|---|---|
| 00–01 | Hero + index | Everything is in the zero | (built) hands reach to a zero of every piece's name; it turns into the index | 10, 13 (hands) |
| 02 | What it leaves out | Not in it: pictures, boxes, cards, shadows, gradients, icons drawn as pictures | Each refused thing is **drawn as itself, made only of its own word**: a framed landscape set in "picture", a box set in "box", a card with its drop shadow set in "card" and "shadow", a gradient set in "gradient" by weight and density alone, an icon set in "icon". Scroll **breaks each picture into its letters, which fall (sprinkle) and settle into a line**: the struck word in the list beneath. What remains: "Kept: words, space and one accent." | 4, 7 (strike-throughs), 17 (engraving tone by line density) |
| 03 | Tune: one sentence retunes the page | Type alone carries every mood | The tune sentence floats on **a sea of type**: rows of words whose baselines ride a travelling swell, nearer rows larger and heavier, far rows hairline and pencil (depth by size and tone, no gradient). The scroll moves the swell; the pointer drops **ripples** that run through the rows and settle. Changing scheme, pair, accent or mode **re-sets the whole sea** in the new face and inks: change one word, everything follows. | 2 (WOVE arc), 9 (waves of lines), 16 |
| 04 | Install: One line. | One line, nothing to untangle | A **string of text in a knot**: the install story ("a package · a wrapper · a theme provider · an update · a breaking change · a peer dependency · …") laid along a tangled curve, each letter turned to the curve. Scroll **pulls the string taut**: the knot unwinds and the string straightens into one line, which lands exactly on the real command line. | 6 (Paul Rand line), 14 |
| 05 | Ask: or ask for it | Your words become the page | The person types (or picks) what to build. **Their words lay out a page**: a sketch of that page at an angle, its heading, columns, a picture-shaped block and a button, all set in *their own words* flowed by pretext into each shape. Typing re-sets it; nothing moves without a key or the pointer. | 3 (Spectra metadata), 12 (stacked roman with italic) |
| 06 | Help build it | Small team, many hands | The four calls (Request, Report, Star, Share) set **large, condensed and stacked at angles**, poster style, crossed by italic notes; **dimension lines and callout strings** tie each to its reason. The scroll slides each line into its place (scrubbed, never on a timer). | 1 (stacked heavy roman, italic overlap), 6 (dimension lines), 11 (Weingart highlights) |
| coda | Start from zero | Back to the zero | A **drop in still water**: concentric rings of text around a zero, the rings being the page's own sentences. The pointer stirs them (ripples run out from it and settle); scroll draws the rings in until they close into the full stop of "Start from zero." The full stop is the one accent. | 5 (discs), 18 |

The section numbers, names, titles and notes stay as they are unless a builder finds a better line; a title change is
noted in the report for the owner.

## Requirements

- **S1 Story order** as in the table; each section shows its claim in its picture before the reader reads a word.
- **S2 Made of type.** Every mark on the page is a letter, a word or a hairline rule. No raster images, icons, fills,
  shadows, gradients or cards. Depth and tone come only from size, weight, density and the three inks (ink, graphite,
  pencil).
- **S3 Two colours and one accent.** Canvases draw with `--ot-ink`, `--ot-graphite`, `--ot-pencil`, `--ot-rule` on
  `--ot-paper`, and at most one `--ot-accent` mark per section, which is also the one accent in view.
- **S4 Faces.** Roman is `--ot-voice`, italic is `--ot-expression`. Interface text is roman; the person's own words are
  italic (05).
- **S5 pretext.** Every shape filled with text uses pretext (`prepareWithSegments`, `layoutNextLine`) through the shared
  helper `components/site/type-shapes.ts`; prepare once per layout, never per frame.
- **S6 Nothing moves by itself.** Motion comes only from the scroll, the pointer or a key. Pointer ripples settle within
  1.5 s and stop drawing. No idle animation loop: `requestAnimationFrame` runs only while something is still moving.
- **S7 Reduced motion** (`prefers-reduced-motion: reduce`): each section shows its **settled state** (02 the struck
  list with the pictures beside it, 03 a calm sea, 04 the straight line, 05 the composed page, 06 the set stack, coda
  the closed rings), with no scroll scrubbing and no ripples.
- **S8 Words stay words.** Every title, list, note and call stays real DOM text, readable by screen readers and search;
  canvases are `aria-hidden`. Links and buttons keep their current destinations and behaviour.
- **S9 Theme.** Each canvas re-reads inks and faces when `html` `data-scheme`, `data-pair`, `data-key` or `data-mode`
  changes, after `document.fonts.ready`.
- **S10 Phone (375).** Each section is composed for a phone, not shrunk: fewer, larger lines; touch drag counts as the
  pointer; no horizontal scroll; nothing smaller than 4 px type in a picture.
- **S11 Performance.** A canvas draws only while on screen (IntersectionObserver), at device pixel ratio capped at 2;
  each frame stays under 4 ms on a laptop; no layout reads inside the draw; no layout shift when a canvas sets up (each
  canvas has its box from CSS before the script runs).
- **S12 Day and nocturne, 1440 and 375.** Each section is checked in all four.
- **S13 Motion contract.** `scripts/check-motion-contract.mjs` and `tests/motion.browser.mjs` keep holding; where a
  section's old rule they check is replaced (the 02 strike), the check is updated to the new truth in the same change,
  keeping its intent (scroll-driven, settled without it).

## Craft notes (from the portfolio session, 2026-10-11)

- **Fine, small type makes the shape; never a few bold letters stuffed into an outline.** Shapes read by line widths
  and density, the way an engraving reads by its hatching.
- A shatter can be quiet: one paragraph setting two figures, one whole and one coming apart only by its line widths.
- The portfolio's through-line is a sun-red point that travels and draws a hairline. Ours must not look like its twin:
  the coda stays rings and water, and no accent dot travels across our page.

## Prior art to learn from (read only; ~/Developer/sanjay-portfolio is never edited)

| Technique | Where |
|---|---|
| Text parting around the pointer like water, one `layoutNextLine` cursor shared by the two runs | `components/ui/wake.tsx` |
| Figures cast in type: outline sets the rows, ink sets weight and tone | `components/site/read/cast.tsx` |
| Rope with Verlet physics, glyphs placed along the thread | `components/site/lab/rope.ts`, `work-strung.tsx` |
| A line settling from dust, a coil or a mirror into place, scroll-scrubbed, real text in the DOM | `components/ui/gather.tsx` |
| Text filling a circle or wave; `rain` as falling streaks | `components/ui/calligram.tsx` |
| Letter particles as a pure function of a playhead, so they play backwards | `components/site/film/letters.ts` |
| Pretext forms P1–P10 (column edge follows a glyph, staircase headline …) | `docs/story/2026-10-10-layout-lock.md` §3 |

## Shared pieces (built first, by the coordinator)

- `components/site/stage.ts`: `const canvasRef = useStage(hostRef, scene)`. It owns the canvas size and DPR, the on-screen
  gate, the scroll progress of the host (0 when its top meets the window's bottom, 1 when its bottom meets the window's
  top), the pointer (with a decaying "since" clock for ripples), reduced motion, theme and font changes, and the frame
  loop that runs only on demand. A scene is `{ layout(f), draw(f) }`; `draw` returns true while it still moves.
- `components/site/type-shapes.ts`: the written technique, generalised. `fillShape(drawShape, text, font, size,
  lineHeight)` rasters a drawn shape, finds every band wide enough for a line and asks pretext for a line exactly that
  wide; `alongPath(points, text, font)` places graphemes along a polyline, each turned to the curve, for strings and
  waves.

## Files (one builder per row, in parallel; no builder edits another's files or app/page.tsx)

| Section | Component | CSS |
|---|---|---|
| 02 | `components/site/landing-leaves.tsx` | `app/landing-leaves.css` |
| 03 | `components/site/landing-sea.tsx` (uses `TuneSentence` from landing.tsx unchanged) | `app/landing-sea.css` |
| 04 | `components/site/landing-install.tsx` | `app/landing-install.css` |
| 05 | `components/site/landing-ask.tsx` (owns `AskFor`, moved from landing.tsx) | `app/landing-ask.css` |
| 06 | `components/site/landing-help.tsx` | `app/landing-help.css` |
| coda | `components/site/landing-coda.tsx` | `app/landing-coda.css` |

## Verification

Per section: typecheck and lint; screenshots at 1440 and 375, day and nocturne, settled and mid-scroll; the reduced
motion state; a frame-time trace over its scroll. At the end: `npm run check`, then one walk of the whole page top to
bottom the way a visitor would, on a laptop and a phone size, before the PR.
