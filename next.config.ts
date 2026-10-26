import { SITE_BASE_PATH } from "./lib/site/config.mjs"
import type { NextConfig } from "next"

const config: NextConfig = {
  output: "export",
  basePath: SITE_BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  // The dev server answers the page at 127.0.0.1 too, but blocks its scripts there unless the host is allowed, and the
  // page then never starts: every canvas stays blank. The browser checks open it at 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
}

export default config
