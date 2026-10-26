import { SITE_URL, sitePath } from "@/lib/site/config.mjs"
import type { Metadata } from "next"

import { ThemeScript } from "@/components/site/theme-script"
import { TopRow } from "@/components/site/top-row"
import { PageRail } from "@/components/site/page-rail"
import { RegistryStyles } from "@/components/site/registry-styles"
import { Toaster } from "@/registry/0nlytype/ui/toast"
import { pageMeta, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site/meta"
import { places, searchGroups } from "@/lib/site/nav"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMeta({ description: SITE_DESCRIPTION }),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="preload" href={sitePath("/fonts/archivo-normal-e3a28eade2.woff2")} as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href={sitePath("/fonts/bodoni-moda-italic-b737328c13.woff2")} as="font" type="font/woff2" crossOrigin="anonymous" />
        <RegistryStyles />
      </head>
      <body>
        <a className="skip ot-link" href="#content">Skip to the content</a>
        {/* No shared TooltipProvider: each Tooltip brings its own, so a page carries tooltip code only when it shows one. */}
        <TopRow places={places} groups={searchGroups} />
        {children}
        <PageRail />
        <Toaster />
      </body>
    </html>
  )
}
