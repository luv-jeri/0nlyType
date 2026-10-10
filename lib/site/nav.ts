import { readFileSync } from "node:fs"

import { catalog } from "@/lib/site/catalog"
import type { SearchGroup } from "@/components/site/search"

export const PAGES = [
  { href: "/", title: "Home", num: "" },
  { href: "/docs/", title: "Index", num: "" },
  { href: "/docs/install/", title: "Install", num: "I" },
  { href: "/docs/build-with-ai/", title: "Build with AI", num: "" },
  { href: "/docs/principles/", title: "Principles", num: "" },
  { href: "/docs/tokens/", title: "Tokens", num: "III" },
  { href: "/feedback/", title: "Feedback", num: "" },
  { href: "/requests/", title: "Requests", num: "" },
]

/** Every token tokens.css defines in its first :root block, in order. */
export const TOKENS: string[] = (() => {
  const css = readFileSync("registry/0nlytype/styles/tokens.css", "utf8")
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")))
  return [...root.matchAll(/(--ot-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
})()

/** Where each path is, for the top row: page names, and each item's movement. The home page names no place: the
 * mark beside it already says where you are. */
export const places: Record<string, { num: string; name: string }> = Object.fromEntries([
  ...PAGES.filter((p) => p.href !== "/").map((p) => [p.href, { num: p.num, name: p.title }]),
  ...catalog.flatMap((m) => m.items.map((e) => [`/docs/${e.meta.name}/`, { num: m.num, name: m.name }])),
])

export const searchGroups: SearchGroup[] = [
  { heading: "Pages", entries: [...PAGES.map((p) => ({ label: p.title, href: p.href })), { label: "Specimen", href: "/specimen/" }] },
  ...catalog.map((m) => ({
    heading: `${m.num} ${m.name}`,
    entries: m.items.map((e) => ({ label: e.meta.title, href: `/docs/${e.meta.name}/`, hint: e.meta.contract, keywords: [e.meta.name, e.meta.contract] })),
  })),
  { heading: "Tokens", entries: TOKENS.map((t) => ({ label: t, href: `copy:var(${t})`, hint: "Copy" })) },
]
