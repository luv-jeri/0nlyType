import { siteURL } from "@/lib/site/config.mjs"
import { readdirSync } from "node:fs"
import path from "node:path"
import type { MetadataRoute } from "next"

import { entries } from "@/lib/site/entries"

export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  // Discover static pages as they are added; the item route uses the same entries
  // as generateStaticParams. The original specimen is copied from public/.
  const pages = readdirSync("app", { recursive: true, encoding: "utf8" })
    .filter((file) => /(?:^|[\\/])page\.(tsx|ts|jsx|js)$/.test(file))
    .map((file) => path.dirname(file).split(path.sep))
    .filter((segments) => !segments.some((segment) => /^[\[_@]/.test(segment)))
    // The lab is for judging work in progress, and asks not to be indexed.
    .filter((segments) => segments[0] !== "lab")
    .map((segments) => segments.filter((segment) => segment !== "." && !segment.startsWith("(")).join("/"))
  const paths = new Set([
    ...pages.map((page) => page ? `/${page}/` : "/"),
    ...entries.map((entry) => `/docs/${entry.meta.name}/`),
    "/specimen/",
  ])
  return [...paths].map((pathname) => ({ url: siteURL(pathname) }))
}
