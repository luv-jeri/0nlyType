# 0nlyType core design

Extracted from DESIGN.md. Read INTENT.md first. Item-specific contracts are in components/<item>.md.

## Principles

1. **Silence is structure.** Space does the layout. A hairline appears only where space alone can't hold two things apart.
2. **Type is the only ornament.** Weight, width, size, tracking and order carry every level of hierarchy. No icons, fills or shadows.
3. **Ours in roman, yours in italic.** Interface text is the voice, upright. Anything the person chose, typed or set turns into the expression italic: a picked option, a typed value, a switch state, a slider value, a named item they own. Display uses `--ot-expression-scale`; text uses the same face in its reading grade, with more ink, a little air and a text-size optical cut where available. Musical and foreign terms are italic too (`.ot-term`), by book convention.
4. **One note of colour.** One accent marks where you are: the current page, the chosen option, focus. At most one accent mark in view. Crimson is only for errors. The highlighter is only for reading marks.
5. **Nothing moves unless you do.** Motion answers an action, then rests. Pointing sketches in pencil; choosing inks it in. The overture plays once per browser, on the home page's first visit, and can be skipped. A demonstration of a component waits for a Demonstrate press. The owner-approved exceptions (2026-10-01) are marquee, text-ribbon and word-relay autoplay: each is pausable and off under reduced motion.

## Conventions

- Tokens are `--ot-*`. Component classes are `ot-<name>`.
- States live on native attributes (`:checked`, `:disabled`, `[aria-selected]`, `[aria-invalid]`, `[aria-current]`, `[aria-pressed]`, `[aria-busy]`). Variants live on `data-variant`, and size on `data-size`.
- `[data-force~="hover"]` and `[data-force~="focus"]` pin a state for documentation rows.
- Every control is built on the right native element, so the React port can use native elements or Radix without changing the look.
- Four switches on `<html>`, all optional:
  - `data-mode="day | nocturne"`
  - `data-scheme="blueprint | statue | silence | riso"` (no attribute means cotton)
  - `data-key="ultramarine | viridian | ember | violet"`, which overrides the scheme's accent and is declared last so it always wins
  - `data-pair="press | paris | salon"` (no attribute means parma)
- One creative move per component, and only one, drawn from the poster references (see "Where each move comes from"). Likewise one motion per component, named as an articulation (see "Motion").
- `[hidden]` always wins over a component's `display`.
- Copy: sentence case, active verbs. An action keeps its name through the flow (Upload, Uploading, Uploaded). Errors say what to fix and never apologise.

## Tokens

### Colour

| Token | Day | Nocturne | Role |
|---|---|---|---|
| `--ot-paper` | `#f2f3f0` | `#10111c` | The page |
| `--ot-ink` | `#000` | `#e9eaec` | Display type, the statement block |
| `--ot-graphite` | `#4a4b50` | `#b4b5bc` | Body text |
| `--ot-pencil` | `#6b6c71` | `#83848c` | Placeholders, captions, done or off |
| `--ot-rule` | ink at 14% (`color-mix`) | same | Hairlines |
| `--ot-rule-strong` | ink at 42% (`color-mix`) | same | Baselines, ticks, rings |
| `--ot-accent` | `#2b2bee` | `#8c8cff` | Where you are |
| `--ot-signal` | `#c8102e` | `#ff6b7f` | Errors only |
| `--ot-mark` | `#ffe45a` | same | Selection, `<mark>`, link hover |
| `--ot-on-mark` | `#000` | same | Text on the highlighter |

Keys (`--ot-accent`, day / nocturne): ultramarine `#2b2bee` / `#8c8cff`, viridian `#0b6e4f` / `#4fd1a5`, ember `#b83d00` / `#ff8a4c`, violet `#6a1b9a` / `#c58cf2`. Every key clears 4.5:1 on every scheme's paper (lowest: ember on silence, 4.56).

Schemes move paper, ink, graphite, pencil, accent and signal together. The rules follow the ink. Values are listed as day, then Nocturne.

| Scheme | Paper | Ink | Pencil | Accent | From |
|---|---|---|---|---|---|
| cotton (house) | `#f2f3f0` / `#10111c` | `#000` / `#e9eaec` | `#6b6c71` / `#83848c` | `#2b2bee` / `#8c8cff` | "It has to be design." |
| blueprint | `#edf0f7` / `#0a1766` | `#0c1b8f` / `#f0f2ff` | `#58608f` / `#929ad0` | `#c23d00` / `#ff9557` | The calendar posters' one orange dot |
| statue | `#ebeae5` / `#0d1528` | `#14213d` / `#eee7d7` | `#5f687e` / `#938d80` | `#875600` / `#e3b04f` | The Renaissance and Greek statue prints |
| silence | `#e2e8e3` / `#0c1c18` | `#0e2a23` / `#e1ebe6` | `#4f6962` / `#7a918a` | `#1b3de0` / `#93a6ff` | "the silence that heals" |
| riso | `#f6f5f2` / `#1a1537` | `#25286b` / `#f8eef5` | `#636591` / `#9d92ab` | `#b8005f` / `#ff62b0` | Two-drum risograph prints |

All text colours (ink, graphite, pencil, accent, signal) clear 4.5:1 on their paper in both modes. Checked with a script, and live on the specimen's palette.

### Type

- `--ot-voice`: a grotesque. Everything the interface says.
- `--ot-expression`: an italic serif. Everything the person says back.
- `--ot-expression-scale`: lifts the display italic until the two x-heights meet. It's set per pair; text roles locally use the reading scale below.

| Pair | Voice | Expression | Scale |
|---|---|---|---|
| parma (house) | Archivo (width 62–125, weight 100–900) | Bodoni Moda (optical size 6–96) | 1.15 |
| press | Schibsted Grotesk (weight 400–900) | Newsreader (optical size 6–72) | 1.1 |
| paris | Instrument Sans (width 75–100, weight 400–700) | EB Garamond | 1.24 |
| salon | Bricolage Grotesque (optical size, width 75–100, weight 200–800) | Cormorant | 1.26 |

**The expression's reading grade.** The italic is the same family at every size. At the text steps (`pp`, `p`, `mp`), thin display strokes need more ink and small counters need room. `base.css` applies one shared grade to typed inputs and textareas, editable text, selected values, text-size personal words, prose `em` / `i` and quotations, and small italic labels. `--ot-reading` is the local scale and supplies `--ot-expression-scale` on the expression element itself, never on a panel. Existing leading and component geometry stay with the sidecar. `.ot-reading` opts a new text-size expression into the same rule; use it on the italic, not a parent containing roman or display type.

| Pair | `--ot-expression-text-opsz` | `--ot-expression-text-weight` | `--ot-expression-text-tracking` | `--ot-expression-text-scale` |
|---|---|---|---|---|
| parma | 6 | 500 | 0.012em | 1.18 |
| press | 6 | 500 | 0.01em | 1.12 |
| paris | No optical-size axis | 500 | 0.015em | 1.3 |
| salon | No optical-size axis | 600 | 0.015em | 1.38 |

For Bodoni Moda and Newsreader, `--ot-expression-text-variation` pins `"opsz"` to `--ot-expression-text-opsz` with automatic optical sizing off. Garamond and Cormorant use `normal` variation settings and their real weight axes. Small italic prose and labels use full `--ot-ink`, rather than graphite or pencil; intentional accent states, ink reversals, invisible measurement copies, disabled controls and roman placeholders keep their own colours. On cotton paper, ink is 18.85:1 by day and 15.59:1 in nocturne; contrast is measured independently of the font's stroke quality.

Display italics keep their original optical sizing, weight, tracking, scale and colour: hero lines, titles, large figures, the overprint and signature fields, sforzando choices, statement relays and fitted type. Do not apply a reading grade to a whole component to catch a small label. Cormorant remains Cormorant; if a use still cannot be read at 16px after grading, propose a text-italic companion for owner review rather than silently substituting a family.

The width moves (the title's exhale, the statement button, the disclosure) only travel as far as each voice's width axis allows. Schibsted has no width axis, so under press they change weight only.
- `--ot-measure`: 62ch.

Dynamics: text steps by a fourth, headings by a fifth. Each size has `-lh` (leading) and `-tr` (tracking) companions.

| Token | Size | Leading | Tracking | Use |
|---|---|---|---|---|
| `--ot-pp` | 13px | 1.45 | 0.01em | Labels, captions |
| `--ot-p` | 17px | 1.6 | 0 | Body |
| `--ot-mp` | 22px | 1.45 | −0.005em | Lead, control text |
| `--ot-mf` | 32px | 1.15 | −0.015em | Heading in a section |
| `--ot-f` | 48px | 1.05 | −0.025em | Section heading, dialog question |
| `--ot-ff` | 72px | 0.95 | −0.035em | Page title |
| `--ot-fff` | clamp(64px, 11vw, 160px) | 0.9 | −0.045em | Movement titles |
| `--ot-ffff` | clamp(64px, 17.5vw, 272px) | 0.82 | −0.055em | The overture only |

### Space, line, shape

- `--ot-space-1` … `--ot-space-10`: 4, 8, 12, 18, 27, 40, 60, 90, 135, 200 (perfect fifths).
- `--ot-hairline` 1px, `--ot-stroke` 1.5px, `--ot-dot` 7px, `--ot-gutter` 24px, `--ot-margin` clamp(20px, 5vw, 80px).
- Grid: 12 columns. Columns 1–3 are the margin (names, notes), 4–12 the stave (the work). One column below 860px.
- Separation, nearest to farthest. Every boundary on a page is one of five, and each has its own space. The farther apart two things are in meaning, the more silence between them, and a nearer pair never gets more space than a farther one. Silence does the separating; a line appears only where space can't.

| Boundary | Space | For example |
|---|---|---|
| Within one thing: a label and its value, a figure and its name, a title and its note | `--ot-space-1`–`3` (4–12) | a state's label over it; a stat's name under its figure |
| A rule and the heading hung under it | `--ot-space-5` (27) on a docs page, `--ot-space-6` (40) on the landing page | a section's rule, then its h2 |
| A heading and what it names | one step more than its rule: `--ot-space-6` (40), `--ot-space-7` (60) on the landing page; `--ot-space-3` (12) under a p-size subheading | an h2 and its lead; a table's name and the table |
| One block and the next inside a section | `--ot-space-7` (60) | a lead and its example; two tables |
| One section and the next | `--ot-space-8` (90) on a docs page, `--ot-space-9` (135) on the landing page, all of it before the rule | the end of Usage, then Contract's rule |

- A section begins at one rule, and only one. Its heading hangs just under that rule, or stands on the rule its content opens with (a list of rows, the steps, as SPECTRA's title stands on its line); then the section draws none of its own. A heading never floats between two lines. The first section after a page's head, and the coda at the end of one, begin in silence alone.
- Hairlines part siblings of one kind: rows, steps, the rows of a table. A boundary between two kinds of thing is silence. A line stands beside what it belongs to, not across the gutter from it.
- When space alone can't carry a boundary (a phone, a dense list), the type changes, one thing at a time and in this order: a step of size, then a step of weight, then the colour, where pencil names a thing, graphite is its body and ink is the thing itself. Two blocks of one kind in one section each carry a visible name, a p-size line in ink, above them.
- Indentation says belonging. A nested list steps in by the width of its dash, so its dash hangs under its parent's words. Items in a list take half a paragraph's pause between them, so a long item still reads as one. Whatever hangs (a list's dash, a quotation mark) hangs into empty margin, never against a line; where the margin is too narrow for it, it steps in.
- Shape vocabulary, complete: hairline, dot, ring, arc, cross, corner marks, parentheses, pill (tags only), and arrows only where there's a direction.

### Tempo

| Token | Value | Use |
|---|---|---|
| `--ot-allegro` | 160ms | Hover, press |
| `--ot-moderato` | 320ms | A state changes |
| `--ot-andante` | 640ms | Panels, toasts, dialogs |
| `--ot-adagio` | 1400ms | The overture, once |
| `--ot-exhale` | cubic-bezier(.16, 1, .3, 1) | Arriving |
| `--ot-breath` | cubic-bezier(.65, 0, .35, 1) | Moving between states |
| `--ot-spiccato` | cubic-bezier(.34, 1.5, .5, 1) | Landing: one small rebound (about 8%) for dots, rings, frames |
| `--ot-arpeggio` | 36ms | The step between things that arrive in turn |

Under `prefers-reduced-motion: reduce`, every tempo is 1ms and the arpeggio is 0: things still change but don't travel. Script-driven motion (rolls, the radio's stretch, tag removal, dusk and dawn) checks the same query and applies the change directly.

## Motion

The owner brought Lenis smooth scrolling back to the site on 2026-10-27 because the landing's scroll-linked animations looked bad with native scrolling, reversing the 2026-10-10 decision. It loads only on the first wheel, pointer press or key event, outside the hero's initial load, and stays off under reduced motion. Scroll-linked pieces read the page in a frame asked for by the scroll event, after the scroller moves it. Anchors use the page's scroll-padding and each target's scroll-margin, with no second offset. Local scrollers and wheel controls keep their `data-lenis-prevent` and `data-lenis-prevent-wheel` marks.

The landing's running section head keeps its title's actual font-size and opening measure, so its lines rebreak as it shrinks. Section typography, direction, padding, column, note fit and unwrapped line widths are cached before hand-over and refreshed on viewport, font and theme changes (including `dir`). Its scroll frame reads the bar and section rects together before it writes. Baseline markers are read after layout in `ResizeObserver`, then the number's shift and the section-rule push-out are written before paint. The pin uses layout containment without paint containment, so its paper and blur keep their reach. Only the bar receives `--pin-k`, rather than inheriting it through the entire document. Phone stacking, right-to-left placement and the fully shrunk reduced-motion head use the same measurements. The landing's live preview of a piece is asked for only once the reading and the page have both been still for 240 ms, and it is fitted and shown only while the page is still: a piece whose example arrives after the page moves again stays unseen until the page has been still for 240 ms, so its fit never runs in a scroll frame.

Three rules, then one articulation per component.

1. **Pointing sketches, choosing inks.** A hover previews in pencil: a hairline strike, a ring, a lean. A commitment draws in ink or the accent.
2. **What's inked lands.** Dots, rings and frames arrive with `--ot-spiccato`, one small rebound.
3. **Strokes pass through.** A stroke drawn on hover leaves the way it was heading: in from the left, off to the right. This uses `background-position` with a `0s` transition, so the anchor flips at once while the size animates.
4. **Demonstrations wait.** An item whose behaviour can be shown (58 scripted ones today, in `components/site/demo-scores.ts`) never plays on its own. Its docs example and the landing's stage offer a Demonstrate bracket button; pressed, it plays one pass from the example's defaults and the button becomes Stop. Stopping, or touching the example, hands it back. Under reduced motion the pass still runs, as instant steps, because the person asked. Discovery only looks; `npm run check:motion` proves that for every scripted entry.

### Shared moves
A move serves more than one component only when it is the same idea on purpose. It keeps one name wherever it appears, so it reads as a move of the system and not a coincidence. The shared ones:
- **quote** (message, hover-card): speech marked by the typographer's own balloon, a quotation mark at a title's size hung in the margin before the words, which are in the italic because they are someone's own. The message's marks frame an exchange from both sides; the hover card's is cut by the card's top edge.
- **the dictionary entry** (hover-card `entry`, questionnaire `definition`): the entry of "the uncreative": headword, part of speech, sense, with part of the headword reversed out of the ink. Whose word it is decides the face: the hover card's headword is ours, heavy roman broken at its syllables with the stressed one reversed; the questionnaire's is yours, the whole word in the large italic reversed out.
- **catchword** (scroll-area, collapsible): the printer's catchword, the first word of what comes next waiting alone at the foot, flush to the far edge. The scroll area's is the first word below the view; the collapsible's is the first name of the rest, which grows into its row as it opens.
- **shelf** (carousel, sheet): books on a shelf. What isn't open shows only its spine, and the one you take out faces you. The carousel is a whole shelf of slides, their names running up the spines; the shelf sheet keeps the spine of the sheet behind in view, and it is the way back.
- **fit** (avatar, resizable): type locked up to its measure, as "It has to be design." sets its words edge to edge: one word set to fill a width. The avatar fits a name to a fixed width, so a short name stands large; the resizable pane refits its title as you move the rule, width axis first and size after.
- **dynamics** (slider, dial): the score's dynamics, which already name the type scale, made a control. The value gets louder as it grows, with its marking (pp to ff) in the italic. The two range controls take the two ways type gets louder: the slider's label in weight and width, the dial's numeral in size.
- **gloss** (accordion, source): the sidenote, a note standing in the outer margin beside the line it glosses, flush to the outer edge, with no rule between. The accordion hangs the answer beside its question; the source moves a comment out of the code, level with its line. The interlinear gloss, set over or under the word (note `ossia`, command-line `parsed`), is a different move.
- **circled** (checkbox; calendar `dots`): a ring drawn round what you chose, after the collage's accent rings. The checkbox's is one pen loop round the words, the calendar's an ink ring round the day. The radio group uses the ballot's cross instead, so one choice is never mistaken for several.

## Registry conventions

- One item is four files: `registry/0nlytype/ui/<item>.tsx`, its sidecar `registry/0nlytype/styles/<item>.css`, the docs meta `content/<item>.ts` and the live example `examples/<item>.tsx`. The base pieces (link, kbd, fraction, meta, corners) have no sidecar; their CSS is in base.css.
- Item names follow shadcn where shadcn has the component; the class keeps the poster's word. `slider` renders `.ot-ruler`.
- Sidecars are wrapped in `@layer components`; base.css is in `@layer base`, so a consumer's Tailwind utilities still win. `!important` appears only on `[hidden]` and `.ot-sr`.
- Direction: logical properties, and `:is([dir="rtl"], [dir="rtl"] *)` where a stroke has a direction. Never `:dir()`: Lightning CSS, which Next and Tailwind run, lowers it to a list of `:lang()` that misses a page that only sets `dir`.
- Variants are `data-variant` and `data-size`, never classes. There's no cva.
- React 19: `ref` is a plain prop. `"use client"` appears only in files that need state, effects, handlers or Radix, so every other item works in a Server Component. Each root and part carries `data-slot`; `className` merges through `cn`.
- Imports inside the registry are `@/registry/0nlytype/ui/<x>`, `@/registry/0nlytype/lib/utils` and `@/registry/0nlytype/lib/<x>`. The build rewrites them to `@/components/ui/<x>`, `@/lib/utils` and `@/lib/0nlytype/<x>`.
- `registryDependencies` is the base item plus every sibling an item imports or lists in its meta's `uses` (a sibling whose classes its CSS borrows). npm dependencies come from its imports.
- The registry is held to the shadcn directory's health checks:
  - `registry.json`'s `name` equals the namespace;
  - every item name is distinct;
  - the index and every item validate against the schema;
  - each item installs on its own with `shadcn add --dry-run`;
  - every endpoint answers over HTTPS with `application/json`.

  An item is added only when it does a job of its own. Never add aliases or splits to raise the count.
- `npm run registry:build` writes `registry.json`, `public/r/*.json`, `app/registry.css` and `lib/site/entries.ts`. All four are committed, and `check:registry` fails if they're stale.

## Docs conventions

- The site and the registry live under `/ui` (Next `basePath`), at https://thedirectors.agency/ui. Next's `Link` adds the base path itself; every other same-origin URL (a `fetch`, an `img`, CSS) is built through `lib/site/config.mjs`, never written by hand.
- The docs are built only from 0nlyType items, plus page layout in `app/site.css`. When a page needs something the library lacks, it's built as an item first.
- A scripted example shows a Demonstrate control above it (see Motion, rule 4). Page titles stay still; the overture exists only on the home page.
- Every item page is generated from `content/<item>.ts`, `examples/<item>.tsx` and this file: its contract under `### ot-<class> (<item>)`, and its rows in "Where each move comes from" and "Motion", which name it in backticks.
- `examples/<item>.tsx` default-exports `Example`, the specimen's demo with real copy. An optional `States` export pins each state with `data-force` on the item's root, inside `<State label>`.
- Theme choices live on `<html>` as `data-mode`, `data-scheme`, `data-key` and `data-pair`, stored under `0nlytype-theme` and restored by a script in `<head>` before first paint. The head script reads the older `0db-theme` when the new key is missing, so a returning visitor keeps their choice; only the new key is written.
