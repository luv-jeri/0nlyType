// Sets the share picture once, in a browser, from the real lockup and the real faces: public/og.png, 1200 by 630, the
// size every link preview reads. Run it again (npm run og:build) when the lockup or the line under it changes.
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { chromium } from "playwright"

import { Lockup } from "../components/site/wordmark.tsx"

const font = (file) => `data:font/woff2;base64,${readFileSync(`public/fonts/${file}`).toString("base64")}`
const fonts = readFileSync("app/fonts.css", "utf8")
const archivo = fonts.match(/archivo-normal-[\w]+\.woff2/)[0]
const bodoni = fonts.match(/bodoni-moda-italic-[\w]+\.woff2/)[0]

const html = `<!doctype html><html><head><style>
@font-face { font-family: "Archivo"; font-weight: 100 900; font-stretch: 62% 125%; src: url(${font(archivo)}) format("woff2"); }
@font-face { font-family: "Bodoni Moda"; font-style: italic; font-weight: 400 900; src: url(${font(bodoni)}) format("woff2"); }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1200px; height: 630px; }
body { background: #f2f3f0; color: #000; font-family: "Archivo"; display: grid; grid-template-columns: auto 1fr; gap: 72px; padding: 0 80px; align-items: center; }
.wm-lockup { display: block; width: 500px; height: auto; overflow: visible; margin-top: 0; }
.wm-creed { font-family: "Bodoni Moda"; font-style: italic; font-weight: 700; }
.wm-stop { fill: #2b2bee; }
.side { display: grid; gap: 28px; padding-top: 70px; }
.line { font-size: 44px; line-height: 1.08; letter-spacing: -0.015em; font-weight: 560; text-wrap: balance; }
.note { font-size: 26px; line-height: 1.3; color: #3a3a3a; font-weight: 420; text-wrap: pretty; }
.where { font-size: 22px; letter-spacing: 0.01em; color: #5a5a5a; }
</style></head><body>
${renderToStaticMarkup(createElement(Lockup))}
<div class="side">
  <p class="line">A component library set entirely in type.</p>
  <p class="note">Two typefaces, one accent and a lot of space. Installs with the shadcn CLI.</p>
  <p class="where">thedirectors.agency/ui</p>
</div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: "public/og.png" })
await browser.close()
console.log("Set public/og.png")
