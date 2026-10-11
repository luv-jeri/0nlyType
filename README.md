# 0nlyType

A component library for type and silence: two typefaces, one accent and a great deal of space. Every control is a typographic idea standing on a native element or a Radix primitive. A checkbox is a sentence you strike through, and a switch is the last word of a sentence.

Everything is type. [INTENT.md](INTENT.md) says who it's for and what it refuses; [DESIGN.md](DESIGN.md) is the how.

**[Docs](https://thedirectors.agency/ui/docs/)** · [Specimen](https://thedirectors.agency/ui/specimen/) · MIT licensed, shadcn-compatible

## Install

You need React 19, TypeScript, Tailwind CSS v4 and a shadcn project with the `@/` alias.

```sh
npx shadcn@latest add https://thedirectors.agency/ui/r/0nlytype.json
npx shadcn@latest add https://thedirectors.agency/ui/r/checkbox.json
```

```tsx
import { Checkbox, CheckboxGroup } from "@/components/ui/checkbox"

export function Brief() {
  return (
    <CheckboxGroup legend="Before we start" tally>
      <Checkbox defaultChecked>Share the brief</Checkbox>
      <Checkbox>Book a first call</Checkbox>
    </CheckboxGroup>
  )
}
```

Four optional switches on `<html>` set the look: `data-mode` (day, nocturne), `data-scheme` (cotton, blueprint, statue, silence, riso), `data-key` (ultramarine, viridian, ember, violet) and `data-pair` (parma, press, paris, salon). [Install](https://thedirectors.agency/ui/docs/install/) has the details.

## Develop

Node 22.12 or newer.

```sh
npm ci
npm run dev      # the docs on localhost:3000/ui/
npm run check    # types, lint, tests, registry, drift, examples, build, pages
npm run check:install   # a fresh Next app installs every item (slow, uses the network)
```

- Items live in `registry/0nlytype/ui/<item>.tsx` with a sidecar `registry/0nlytype/styles/<item>.css`, a demo in `examples/<item>.tsx` and docs meta in `content/<item>.ts`.
- `scripts/build-registry.mjs` writes `registry.json` and `public/r/`. Never edit those by hand.
- The docs site is built from 0nlyType's own items. `app/site.css` only places them.

## Deploy

The canonical site is `https://thedirectors.agency/ui`; change its owner default in `lib/site/config.mjs`. Next exports to `out/`, and `npm run package:site` copies it to `dist/ui/` with domain-root robots, redirects, headers and a 404 page. Both `npm run build` and `npm run check` produce this package. CI deploys `dist/` to Cloudflare Workers (`wrangler.jsonc`) on every push to `main`, once the `CLOUDFLARE_API_TOKEN` repository secret exists.

Fonts are self-hosted under the SIL Open Font License; see [FONT-NOTICES.md](FONT-NOTICES.md).

## Contributing

Read [AGENTS.md](AGENTS.md) first. It gives the reading order, the rules, and what "done" means, for people and AI agents alike. Work on a branch, and open a pull request against `main`.

Made by The Directors: Sanjay Kumar and Abhay Rohit.
