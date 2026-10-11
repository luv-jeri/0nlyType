import { siteURL } from "@/lib/site/config.mjs"
import type { Metadata } from "next"

export const SITE_NAME = "0nlyType"
export const SITE_DESCRIPTION = "A React component library set entirely in type: two typefaces, one accent and a lot of space. Installs with the shadcn CLI."
export const REPO = "https://github.com/luv-jeri/0nlyType"
export const STUDIO = { "@type": "Organization", name: "The Directors", url: "https://thedirectors.agency" }

// The share picture (scripts/build-og.mjs), named in full: a relative path would resolve against the origin and lose /ui.
const IMAGE = { url: siteURL("/og.png"), width: 1200, height: 630, alt: "0nlyType, a component library set entirely in type." }

/**
 * A page's title and description, and the same pair on its share cards. Next takes a page's openGraph and twitter
 * whole, in place of the layout's, so every page states both in full. `title` is the page's own name; the site name is
 * added once, by the layout's template on the page and here on the cards.
 */
export function pageMeta({ title, description, absolute }: { title?: string; description: string; absolute?: string }): Metadata {
  const full = absolute ?? (title ? `${title} · ${SITE_NAME}` : SITE_NAME)
  return {
    title: absolute ? { absolute } : title,
    description,
    alternates: { canonical: "./" },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url: "./", title: full, description, images: [IMAGE] },
    twitter: { card: "summary_large_image", title: full, description, images: [IMAGE] },
  }
}
