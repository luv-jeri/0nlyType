import { SITE_URL, sitePath } from "@/lib/site/config.mjs"
import type { Metadata } from "next"

import { ThemeScript } from "@/components/site/theme-script"
import { TopRow } from "@/components/site/top-row"
import { PageRail } from "@/components/site/page-rail"
import { RegistryStyles } from "@/components/site/registry-styles"
import { Toaster } from "@/registry/0nlytype/ui/toast"
import { TooltipProvider } from "@/registry/0nlytype/ui/tooltip"
import { places, searchGroups } from "@/lib/site/nav"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "0nlyType", template: "%s · 0nlyType" },
  description: "A component library set entirely in type: two typefaces, one accent and a great deal of space. Installs with the shadcn CLI.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: "0nlyType",
    locale: "en_US",
    url: "./",
    title: { default: "0nlyType", template: "%s · 0nlyType" },
    description: "A component library set entirely in type: two typefaces, one accent and a great deal of space. Installs with the shadcn CLI.",
  },
  twitter: {
    card: "summary",
    title: { default: "0nlyType", template: "%s · 0nlyType" },
    description: "A component library set entirely in type: two typefaces, one accent and a great deal of space. Installs with the shadcn CLI.",
  },
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
        <TooltipProvider>
          <TopRow places={places} groups={searchGroups} />
          {children}
        </TooltipProvider>
        <PageRail />
        <Toaster />
      </body>
    </html>
  )
}
