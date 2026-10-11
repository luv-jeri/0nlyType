# Working on 0nlyType

0nlyType is the component library of The Directors, the product studio of Sanjay Kumar and Abhay Rohit. The studio's own landing page at thedirectors.agency is built on it first. The library is published as a shadcn registry at https://thedirectors.agency/ui. It is its own product, separate from Cojeev and 000h.

This file is for anyone changing this repository, whether a person or an AI agent. People who build *with* 0nlyType get a separate AGENTS.md from the AI kit, which the build generates from INTENT.md and DESIGN.md.

## Read first, in this order

1. [INTENT.md](INTENT.md): what 0nlyType is, who it's for and what it refuses. When two rules disagree, this one wins.
2. [DESIGN.md](DESIGN.md): the Principles, Conventions, Tokens and Motion sections, plus the contract (`### ot-<name> (<item>)`) of every item you touch or compose from.
3. The item's four files: `registry/0nlytype/ui/<item>.tsx`, `registry/0nlytype/styles/<item>.css`, `content/<item>.ts` and `examples/<item>.tsx`.
4. `docs/references/`: the posters each creative move comes from. A change that passes every check but ignores the references is still rejected.
5. The Next.js note at the end of this file.

## Where things are

| Path | What it holds |
|---|---|
| `registry/0nlytype/` | The library itself: items, sidecar CSS, base tokens, and the AI kit sources |
| `styles/0nlytype/`, `lib/0nlytype/`, `docs/0nlytype/` | Not in this repo: where an install writes in a user's project (CSS, helpers, and the AI kit's docs) |
| `content/`, `examples/` | Docs meta and the live example for each item |
| `app/`, `components/site/` | The docs site, built only from 0nlyType items; `app/site.css` only places them |
| `lib/site/config.mjs` | The one place where the site origin and the `/ui` base path are set |
| `scripts/` | The registry build, packaging, and every check |
| `workers/reporting/` | The feedback service behind the report and request forms |
| `docs/superpowers/` | The decision record: specs, plans, briefs and review reports |

## Rules

- Type is the only ornament: icons are allowed only as signs made of their own word (owner decision 2026-10-10); no icon drawn as a picture; no cards, fills, shadows or gradients, and one accent in view. Interface text is roman; anything the person chose or typed is italic.
- Names (owner decision 2026-10-10): `ot-` classes, `--ot-` tokens, and `data-variant`, `data-size` and `data-force` attributes. No cva and no `:dir()`. `!important` appears only on `[hidden]` and `.ot-sr`.
- Copy is plain and written the way a person would say it: no long dash (—) in anything a page shows, its title or its description; use a comma, a colon or a full stop. `check:headers` fails on one.
- Never run prettier or any formatter. Match the file you're in: no semicolons, double quotes.
- Never hand-edit generated files: `registry.json`, `public/r/*`, `public/ai/*`, `public/llms*.txt`, `lib/site/entries.ts` and `app/registry.css`. Run `npm run registry:build` instead.
- Never write a same-origin URL by hand, such as `"/docs/…"` in a `fetch`, an `img` or CSS. Next's `Link` adds `/ui` for you. Everything else goes through `lib/site/config.mjs`.
- A new `content/<item>.ts` needs its `examples/<item>.tsx` in the same change, or the whole site fails to build.
- Secrets never go into the repo or a chat. Tokens are pasted only at a `wrangler secret put` prompt.

## Before you say it's done

1. `npm run check` passes: types, lint, tests, registry, drift, examples, build and packaging, pages and headers.
2. You've looked at what you changed at 1440 and 375 pixels wide, in day and nocturne, and in right-to-left wherever there's a direction.
3. Wherever DESIGN.md and the code disagree, you've fixed one of them in the same change. `check:drift` catches most of these.

## Git

- `main` is the deployed branch. Work on a branch, open a pull request, and merge once CI is green. A push to `main` deploys `dist/` to Cloudflare once the `CLOUDFLARE_API_TOKEN` repository secret is set. Until then, deploys run locally with `npx wrangler@4.144.0 deploy`.
- One step per commit, with a message that says what changed and why, so that any step can be rolled back on its own.

## Where the project stands (2026-10-02)

- **Pre-release.** The library is named 0nlyType (owner decision 2026-10-10; it was 0dB). The copy carries the new name. The machine names follow it: the `0nlytype` base item (`r/0nlytype.json`), the `registry/0nlytype` directory, the install paths `styles/0nlytype/`, `lib/0nlytype/` and `docs/0nlytype/`, the `ot-` class and `--ot-` token prefixes (they were `db-` and `--db-`), the `0nlytype-theme` and `0nlytype-overture-seen` storage keys (the old keys are read once as a fallback) and the `luv-jeri/0nlyType` repository (renamed at merge). The reporting worker, its D1 and R2 names, the `0db-feedback` repository, the Cloudflare worker name `0db`, and the `0db-runner` and `0db-index-folded` browser keys keep their old names.
- **Not listed anywhere yet:** no shadcn directory entry, no release and no announcement until the launch plan is ready. Deploys and pushes are fine.
- **Ranking:** the directory ranks by registry health and by the number of distinct items. Only real items count toward it; never add aliases or splits to raise the count, though each sign variant (dots, words, fill) is its own item by owner decision 2026-10-10. The rules are in `docs/superpowers/reports/2026-10-01-directory-ranking.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
