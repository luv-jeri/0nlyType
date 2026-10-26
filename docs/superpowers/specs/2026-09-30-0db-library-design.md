# 0dB: the component library and its own docs

Date: 2026-09-30. Status: approved in conversation, section by section. The owner then asked to proceed without further questions.

## Intent

0dB (formerly Fermata) becomes a shadcn registry library in the shape of 000h by Cojeev. Its docs site is built only from 0dB's own components; there is no Fumadocs. When the docs need a component that doesn't exist, it's built and added to the library. The repo is `github.com/luv-jeri/0dB`, and it's hosted at `https://0db.cojeev.com`.

Done means all of these hold:
1. `npx shadcn add https://0db.cojeev.com/r/<name>.json` installs a component into a fresh Next app. The app builds, and the component looks and behaves like the specimen.
2. Every page of the docs site is made from 0dB components plus page-level layout CSS.
3. INTENT.md and DESIGN.md exist, and the drift check holds them to the code.
4. `npm run check` passes locally and in CI, and the site is deployed.

Decisions already made (don't re-derive them):
- The name is **0dB**.
- The host is 0db.cojeev.com, on Cloudflare static assets.
- One spec covers everything.
- Primitives follow approach **A**: native where the specimen is native, and Radix or cmdk only for menus, overlays that float, the combobox and command.

## 1. Repo layout

```
INTENT.md  DESIGN.md  README.md  LICENCE (MIT)  FONT-NOTICES.md
registry.json                      generated, committed
registry/0db/ui/<item>.tsx         one file per item
registry/0db/styles/<item>.css     the sidecar, lifted from its fermata.css fence
registry/0db/styles/{tokens,base,fonts}.css   the base item
registry/0db/styles/fonts-{press,paris,salon}.css   optional pair items
registry/0db/lib/utils.ts          cn (clsx + tailwind-merge)
content/<item>.ts                  docs metadata per item (see §5)
examples/<item>.tsx                live example; its source is what the page shows
app/                               Next 16 static export (the docs site)
components/site/                   docs-only compositions, built from 0dB items
scripts/                           build-registry, check-drift, check-examples, check-install, check-pages
specimen/                          the old fermata/ folder, served at /specimen/ unchanged
public/r/*.json                    generated registry payloads, committed
wrangler.jsonc  public/_headers    Cloudflare static assets
.github/workflows/ci.yml           check on PRs; deploy on main
```

## 2. Naming

- **Tokens** go from `--f-*` to `--db-*`. **Classes** go from `f-<name>` to `db-<name>`. **Keyframes** go from `f-*` to `db-*`. Tailwind has no `db-` utilities, so nothing clashes.
- **Registry item names** use shadcn's name where shadcn has that component; otherwise they use the specimen's word. The CSS class keeps the poster name. For example, the item `slider` exports `Slider`, which renders `.db-ruler`.
- **The namespace** is `@0db`. The base item is `0db`.

## 3. The registry

- **The base item `0db`** (`registry:base`):
  - files: `tokens.css`, `base.css`, `fonts.css` and `lib/utils.ts`
  - dependencies: clsx and tailwind-merge
  - `css` imports its three files
  - `cssVars.theme`, which maps tokens for Tailwind v4 through `@theme inline` (`--color-paper: var(--db-paper)` …)
  - `@custom-variant dark` on `[data-mode=nocturne]`
- **base.css holds:**
  - the reset and globals: selection, focus, mark, hr, `[hidden]`, scrollbars
  - the shared keyframes: `db-arrive`, `db-land`, `db-draw-x`, `db-draw-y`
  - the type roles (`db-pp` … `db-ffff`, `db-yours`, `db-term`, `db-label`, `db-figures`, `db-sr`)
  - the base pieces (link, meta, kbd, corners, fraction), because other fences style through them

  It's wrapped in `@layer base`. Component sidecars are wrapped in `@layer components`, so Tailwind utilities still override them.
- **fonts.css** is the default pair, Parma (Archivo variable with the wdth and wght axes, and Bodoni Moda variable in roman and italic). It's Latin-subset woff2, embedded as data URIs like 000h, so no files have to be placed in `public/`. The other three pairs are optional items: `fonts-press`, `fonts-paris` and `fonts-salon`. The OFL notices ship with the base.
- **Component items** (`registry:ui`) consist of `ui/<item>.tsx` plus `styles/<item>.css`, which is installed to `styles/0db/<item>.css` and added through the item's `css` `@import`, exactly as in 000h.
  - `registryDependencies` is the base URL plus the URL of any sibling item it imports or whose CSS it relies on.
  - npm `dependencies` are derived from the item's imports.
- **Imports are rewritten at build time:** `@/registry/0db/ui/x` becomes `@/components/ui/x`, and `@/registry/0db/lib/utils` becomes `@/lib/utils`.
- **The base URL** is `https://0db.cojeev.com`, and it can be overridden by `DB_REGISTRY_URL` for local install checks.

## 4. Components

The shape every item follows:
- `ui/<item>.tsx` with React 19 (a ref is a plain prop, so no `forwardRef`).
- `"use client"` only where state, effects or Radix require it.
- A root class `db-<name>`, plus `className` merged through `cn`.
- `data-slot` on the root and each part.
- Native props passed straight through.

**Variants are `data-variant` and `data-size` attributes, not cva.** The specimen's CSS keys on those attributes, so the sidecar stays the specimen's CSS. This changes Section 2, as approved in chat, and the reason is recorded here. `Button` supports `asChild` through `@radix-ui/react-slot`.

The rules every item keeps, and the item enforces them rather than the consumer:
- **Ours in roman, yours in italic.** Whatever a person typed or chose renders in the expression face.
- **One accent per view.** The accent only marks what's current, selected or focused.
- **Nothing moves unless the person acts.** Reduced motion makes every articulation instant.
- **No icons, cards or shadows.**
- Logical properties throughout, with `:dir(rtl)` where a stroke has a direction.

**What sits underneath:**
- **Native:** the element carries the state, and the CSS reads `:checked`, `[open]` and `[aria-*]`.
- **Hook:** the specimen's script, ported to a small React hook inside the item's file.
- **Radix and cmdk:** the CSS reads `[data-state]` instead of `:popover-open`. Radix does the positioning (`side`, `align`, `sideOffset`), and the CSS anchor positioning is dropped for these items.

### The items (67, plus the base and three font pairs)

| Movement | Item | Class | Underneath | Registry dependencies besides base |
|---|---|---|---|---|
| II Type | link | db-link | native | |
| II Type | kbd | db-kbd | native | |
| II Type | fraction | db-fraction | native | |
| IV Space & line | meta | db-meta | native | |
| IV Space & line | corners | db-corners | native | |
| VI Controls | button | db-btn | native, plus Slot | spinner |
| VI Controls | checkbox | db-check | native (with a tally through fraction) | fraction |
| VI Controls | radio-group | db-choice | native, plus a hook (the dot's position) | |
| VI Controls | dial | db-dial | native, no script | |
| VI Controls | picks | db-picks | native | |
| VI Controls | switch | db-switch | native, `role="switch"` | |
| VI Controls | slider | db-ruler | native range, plus a hook (the readout) | |
| VI Controls | field | db-field (Field, Input, Textarea, FieldError) | native, plus a hook (the counter) | |
| VI Controls | select | db-select | native select | |
| VI Controls | toggle | db-toggle | Radix Toggle | |
| VI Controls | toggle-group | db-toggles | Radix ToggleGroup | toggle |
| VI Controls | button-group | db-btn-group | native | button |
| VI Controls | input-group | db-input-group | native | button, field |
| VI Controls | input-otp | db-code | native, plus a hook | field |
| VI Controls | combobox | db-combo | cmdk inside a Radix Popover | popover |
| VI Controls | date-picker | db-date | Radix Popover with calendar | popover, calendar |
| VI Controls | form | (composition) | native constraint validation, plus a hook | button, field, spinner |
| VII Signals | spinner | db-dots | native | |
| VII Signals | progress | db-progress | native `<progress>` | |
| VII Signals | toast | db-toast | hook (a tiny store and a Toaster) | button |
| VII Signals | dialog | db-dialog (also `alert` for role alertdialog) | native `<dialog>`, plus a hook | button |
| VII Signals | empty | db-empty | native | button |
| VII Signals | alert | db-alert | native | |
| VII Signals | skeleton | db-skeleton | native | |
| VIII Wayfinding | tabs | db-tabs | Radix Tabs | |
| VIII Wayfinding | rows | db-rows | native | |
| VIII Wayfinding | pagination | db-pager | native | |
| VIII Wayfinding | breadcrumb | db-crumbs | native | |
| VIII Wayfinding | accordion | db-disclose | native `<details>` | |
| VIII Wayfinding | calendar | db-month | hook | |
| VIII Wayfinding | badge | db-tag | native | |
| VIII Wayfinding | note | db-note | native (hover and focus) | |
| VIII Wayfinding | navigation-menu | db-navmenu | Radix NavigationMenu | |
| VIII Wayfinding | dropdown-menu | db-menu | Radix DropdownMenu | popover |
| VIII Wayfinding | context-menu | db-menu | Radix ContextMenu | dropdown-menu |
| VIII Wayfinding | menubar | db-menubar | Radix Menubar | dropdown-menu |
| VIII Wayfinding | command | db-command (Command, CommandDialog) | cmdk, with the dialog through Radix Dialog | |
| VIII Wayfinding | sidebar | db-sidebar | native, plus a hook | sheet |
| VIII Wayfinding | steps | db-steps | native `<ol>` (**new**) | |
| IX Surfaces | card | db-card | native | |
| IX Surfaces | popover | db-pop | Radix Popover | |
| IX Surfaces | hover-card | db-peek | Radix HoverCard | |
| IX Surfaces | tooltip | db-tip | Radix Tooltip | |
| IX Surfaces | sheet | db-sheet | native `<dialog>` | dialog |
| IX Surfaces | drawer | db-drawer | native `<dialog>` | dialog |
| IX Surfaces | collapsible | db-collapse | native `<details>` | |
| IX Surfaces | resizable | db-resize | hook (a separator) | |
| IX Surfaces | scroll-area | db-scroll | native, with the scrollbar | scrollbar |
| IX Surfaces | scrollbar | db-scrollbar | hook (`useScrollbar`) | |
| IX Surfaces | aspect-ratio | db-ratio | native | fraction |
| IX Surfaces | carousel | db-carousel | scroll-snap, plus a hook | |
| X Data | table | db-table | native | |
| X Data | chart | db-chart | our own markup, plus a hook | |
| X Data | avatar | db-avatar | native | |
| X Data | item | db-item | native | |
| X Data | typography | db-prose | native | |
| X Data | source | db-source (**new**: a code block with Copy) | build-time highlighting via sugar-high, plus Copy | button, toast |
| XI Conversation | message | db-msg, db-bubble, db-reactions | native | avatar, badge |
| XI Conversation | marker | db-marker | native | |
| XI Conversation | attachment | db-attach | native | button |
| XI Conversation | thread | db-thread | native, with the scrollbar | message, scrollbar |
| XI Conversation | questionnaire | db-quest | native | fraction, radio-group, button |

The dependency column is a starting point. The real list is derived from each item's imports, plus any class or keyframe it borrows from another sidecar.

**The three new items:**
- **steps:** a numbered `<ol>`. The numbers are a real sequence, set as large roman figures in the margin, with the current step in accent.
- **source:** a code block. Strings are italic (what someone wrote), comments are pencil, keywords are roman ink, and there's no second colour. The Copy action is a bracket button, and the toast reads "Copied."
- **CommandDialog:** the ⌘K palette. It takes the item off "Skipped for now".

## 5. The docs site

- Next 16 App Router, `output: "export"`, `trailingSlash: true`.
- Tailwind v4 is imported the way a consumer would, so compatibility is exercised on every build.
- The owner brought Lenis smooth scrolling back on 2026-10-27 because the landing's scroll-linked animations looked bad without it, reversing the 2026-10-10 removal. It loads only on the first wheel, pointer press or key event and stays off under reduced motion. Anchor links keep their offset through scroll-padding and scroll-margin; items keep their `data-lenis-prevent` and `data-lenis-prevent-wheel` marks for local scrolling.
- The theme (mode, scheme, key, pair) is restored from `localStorage` by an inline script in `<head>` before first paint.

**Pages:**
- `/`: the overture. The "0dB" wordmark exhales along its wdth axis, and the pretext manifesto flows around the dot. The principles follow.
- `/docs/`: the index. Items are listed as `rows`, grouped by movement.
- `/docs/<item>/`: one page per item.
- `/docs/install/`: `steps` plus `source`.
- `/docs/tokens/`: click a token to copy it.
- `/docs/principles/`: the principles.
- `/specimen/`: the original page, copied as it is.

**The frame:**
- The margin holds the sidebar, which becomes a `sheet` on narrow screens.
- The stave holds the content.
- The fixed top row shows the current movement and holds the controls (`picks` and `select` for scheme, pair and key; `switch` for Nocturne) and the ⌘K trigger.
- The page `scrollbar` rail marks every section, so it's the table of contents.

**An item page, top to bottom:**
1. The name in `db-fff`, with its summary.
2. The live `Example` inside `corners`, then `States` when the example exports it.
3. Install: `tabs` (CLI or manual) with `source`.
4. Usage: the example file's source, with imports shown as `@/components/ui/…`.
5. The DESIGN.md contract, rendered from the markdown at build time: anatomy, keyboard and notes.
6. Props as a `table`, from `content/<item>.ts`.
7. The item's rows from "Where each move comes from" and "Motion".
8. Previous and next as `pagination`.

**`content/<item>.ts`** exports:
- `name`, `title` and `movement` (a Roman numeral)
- `contract`, meaning the class that heads its DESIGN.md contract, e.g. `db-btn`
- `summary`, one sentence
- `underneath`: native, hook, radix or cmdk
- `props`: `{ name, type, default?, description }[]`

**Search:** `CommandDialog` over a static index of items, tokens and pages. cmdk does the matching.

## 6. INTENT.md and DESIGN.md

- **INTENT.md** is one page: the name, who it's for, what success looks like, what it refuses and why, its non-goals, and what to do when in doubt.
- **DESIGN.md** is the renamed spec, reorganised as:
  1. principles, tokens and the shape vocabulary
  2. one contract per item, headed `### db-<class> (<item>)` and naming what sits underneath
  3. "Where each move comes from" and "Motion"
  4. registry conventions and docs conventions
  5. "Skipped for now"

## 7. Checks

`npm run check` runs, and CI runs the same thing:
1. **`typecheck` and `lint`:** eslint with zero warnings. It also fails on any `!important` in the registry CSS, except the allowlisted `[hidden]` and `db-sr` rules in base.css.
2. **`check:registry`:** a rebuild must produce the committed `registry.json` and `public/r/*.json` byte for byte.
3. **`check:drift`:** every item has `ui`, `content` and `examples` files and a DESIGN.md contract, and every `--db-*` token used in the registry CSS is defined in tokens.css.
4. **`check:examples`:** every example compiles with `tsc` after its imports are rewritten the way a consumer's would be.
5. **`check:install`:** a scratch Next app, with the registry served locally, runs `shadcn add` for every item, and then `next build` passes.
6. **`check:pages`:** Playwright opens every page of the export at 375px and 1440px. It fails on console errors or sideways overflow.

A one-time browser pass at the end, done manually, covers:
- the look against the specimen, in Day and Nocturne
- the keyboard on the Radix and cmdk items
- reduced motion
- ⌘K

## 8. Deploy

- **Hosting:** `wrangler.jsonc` serves static assets from `out/`, with the custom domain `0db.cojeev.com` and a 404 page. `public/_headers` sets the security headers, plus `Access-Control-Allow-Origin: *` on `/r/*`.
- **CI:** it runs check and build on pull requests and pushes. On `main`, it deploys with `CLOUDFLARE_API_TOKEN` (a repo secret the owner adds). If the secret is missing, the step skips and says so.
- **Git:** work happens on `library`, with a draft pull request into `main` titled "DO NOT MERGE — needs Sanjay".

## Skipped (and why)

- **A beta environment:** there are no outside users yet.
- **Submitting to the shadcn directory:** it's a public pull request on another repo, so the entry is drafted at `docs/directory-entry.json` for the owner to send.
- **cva:** see §4.
- **The motion library and icon set:** the CSS already does the articulations, and icons are refused.
