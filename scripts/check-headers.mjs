import { fixtureReportingReads } from "./lib/reporting-fixture.mjs"
import { SITE_URL, SITE_BASE_PATH, sitePath } from "../lib/site/config.mjs"
import { packageHeaders } from "./lib/site-assets.mjs"
// Checks the local static export with Workers header rules, not next dev.
// This is not a live Cloudflare routing or deployment check. Workers append headers;
// a matching `! Header` removes the earlier value before the next value is added.
// https://developers.cloudflare.com/workers/static-assets/headers/
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { once } from "node:events"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { chromium } from "playwright"

const root = path.resolve("dist")
const read = (file) => readFileSync(path.join(root, file), "utf8")
assert(existsSync(path.join(root, "_headers")), "No dist/_headers. Run npm run build first.")
assert.equal(read("_headers"), packageHeaders(readFileSync("public/_headers", "utf8")), "Packaged headers are stale. Rebuild.")
assert(existsSync(path.join(root, "404.html")), "The static export needs 404.html.")
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""))
assert.equal(path.resolve(config.assets.directory), root)
assert.equal(config.assets.not_found_handling, "404-page")
assert.equal(config.assets.html_handling, "auto-trailing-slash")

const rules = []
for (const line of read("_headers").split(/\r?\n/)) {
  assert(line.length <= 2000, "Workers limits each _headers line to 2,000 characters.")
  if (!line.trim() || line.trim().startsWith("#")) continue
  if (!/^\s/.test(line)) {
    // The authored file uses path rules and one greedy splat; reject unsupported
    // syntax rather than silently test different rules from the deployed ones.
    assert(line.startsWith("/") && !line.includes(":"), `Unsupported header path: ${line}`)
    assert((line.match(/\*/g) ?? []).length <= 1, `Too many splats: ${line}`)
    const pattern = line.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")
    rules.push({ match: new RegExp(`^${pattern}$`), set: [], unset: [] })
  } else {
    const rule = rules.at(-1)
    assert(rule, "Header without a path rule")
    const unset = line.trim().match(/^!\s+([\w-]+)$/)
    if (unset) rule.unset.push(unset[1].toLowerCase())
    else {
      const header = line.trim().match(/^([\w-]+):\s*(.+)$/)
      assert(header, `Invalid header: ${line}`)
      rule.set.push([header[1].toLowerCase(), header[2]])
    }
  }
}
assert(rules.length <= 100, "Workers limits _headers to 100 rules.")

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" }
function headersFor(pathname, file) {
  const headers = new Headers({ "content-type": types[path.extname(file)] ?? "application/octet-stream", "cache-control": "public, max-age=0, must-revalidate" })
  const set = new Set()
  for (const rule of rules) {
    if (!rule.match.test(pathname)) continue
    for (const key of rule.unset) headers.delete(key)
    for (const [key, value] of rule.set) {
      if (set.has(key)) headers.append(key, value)
      else { headers.set(key, value); set.add(key) }
    }
  }
  return Object.fromEntries(headers)
}

const server = createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
    let file = path.resolve(root, `.${pathname}`)
    if ((file !== root && !file.startsWith(root + path.sep)) || pathname === "/_headers") {
      res.writeHead(404).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!pathname.endsWith("/")) { res.writeHead(307, { location: pathname + "/" }).end(); return }
      file = path.join(file, "index.html")
    } else if (!existsSync(file) && existsSync(file + ".html")) file += ".html"
    const found = existsSync(file) && statSync(file).isFile()
    if (!found) file = path.join(root, "404.html")
    res.writeHead(found ? 200 : 404, headersFor(pathname, file))
    res.end(req.method === "HEAD" ? undefined : readFileSync(file))
  } catch {
    res.writeHead(400).end()
  }
})

const pages = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!entry.name.startsWith("_") && entry.name !== "r" && entry.name !== "404") walk(file)
    } else if (entry.name === "index.html") {
      // A page that asks not to be indexed (the lab) stays out of the sitemap.
      if (/<meta name="robots" content="[^"]*noindex/.test(readFileSync(file, "utf8"))) continue
      pages.push("/" + path.relative(uiRoot, dir).split(path.sep).join("/") + (dir === uiRoot ? "" : "/"))
    }
  }
}
const uiRoot = path.join(root, SITE_BASE_PATH)
walk(uiRoot)
const origin = SITE_URL
const failures = []
let browser
try {
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const base = `http://127.0.0.1:${server.address().port}`
  const fetchPage = (url, options) => fetch(base + (url === "/robots.txt" || url.startsWith(`${SITE_BASE_PATH}/`) ? url : sitePath(url)), options)
  const checkSecurity = (response) => {
    assert.equal(response.headers.get("x-content-type-options"), "nosniff")
    assert.equal(response.headers.get("x-frame-options"), "DENY")
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
    assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()")
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains")
    const csp = response.headers.get("content-security-policy") ?? ""
    const policy = Object.fromEntries(csp.split(";").map((part) => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values]))
    for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) assert(csp.includes(directive), `Missing ${directive}`)
    assert(!csp.includes("'unsafe-eval'"), "Production CSP must block eval.")
    const specimen = new URL(response.url).pathname.startsWith(sitePath("/specimen/"))
    const required = specimen
      ? { "script-src": ["https://esm.sh"], "style-src": ["https://fonts.googleapis.com"], "font-src": ["https://fonts.gstatic.com"], "connect-src": ["https://esm.sh"], "frame-src": ["'none'"] }
      : { "script-src": ["https://challenges.cloudflare.com", "https://static.cloudflareinsights.com"], "connect-src": ["https://feedback.thedirectors.agency", "https://challenges.cloudflare.com"], "frame-src": ["https://challenges.cloudflare.com"] }
    for (const [directive, sources] of Object.entries(required)) {
      for (const source of sources) assert(policy[directive]?.includes(source), `${directive} must permit ${source}`)
    }
    const allowed = new Set(Object.values(required).flat())
    for (const sources of Object.values(policy)) {
      for (const source of sources) if (source.startsWith("https://")) assert(allowed.has(source), `Unexpected CSP origin: ${source}`)
    }
  }
  const robots = await fetchPage("/robots.txt")
  assert.equal(robots.status, 200)
  const robotsText = await robots.text()
  assert.match(robotsText, /User-Agent: \*/i)
  assert.match(robotsText, /Allow: \/(?:\r?\n|$)/)
  assert(robotsText.includes(`Sitemap: ${origin}/sitemap.xml`))
  const sitemap = await fetchPage("/sitemap.xml")
  assert.equal(sitemap.status, 200)
  assert.match(sitemap.headers.get("content-type"), /^application\/xml/)
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.equal(urls.length, new Set(urls).size, "Duplicate sitemap URLs")
  assert.deepEqual([...urls].sort(), pages.map((url) => origin + url).sort(), "Sitemap must list every public page, excluding error routes.")

  for (const url of pages) {
    const response = await fetchPage(url)
    assert.equal(response.status, 200, url)
    checkSecurity(response)
    assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate", url)
    const html = await response.text()
    if (url === "/specimen/") continue // Original HTML has no Next metadata.
    assert(html.includes(`<link rel="canonical" href="${origin + url}"`), `Wrong canonical: ${url}`)
    assert(html.includes(`<meta property="og:url" content="${origin + url}"`), `Wrong Open Graph URL: ${url}`)
    for (const tag of ["<title>", 'name="description"', 'property="og:title"', 'property="og:description"', 'property="og:type" content="website"', `property="og:image" content="${origin}/og.png"`, 'name="twitter:card" content="summary_large_image"', 'name="twitter:title"', 'name="twitter:description"', `name="twitter:image" content="${origin}/og.png"`]) assert(html.includes(tag), `${url}: missing ${tag}`)
    // Each page's share card carries its own title and description, not the home page's.
    const meta = (attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1]
    const title = html.match(/<title>([^<]*)<\/title>/)[1]
    assert.equal(meta("property", "og:title"), title, `${url}: og:title differs from the title`)
    assert.equal(meta("name", "twitter:title"), title, `${url}: twitter:title differs from the title`)
    assert.equal(meta("property", "og:description"), meta("name", "description"), `${url}: og:description differs from the description`)
    // Copy is plain: no long dash in the title, the description or anything the page shows.
    assert(!/\u2014/.test(title + meta("name", "description")), `${url}: the title or description has a long dash`)
    const shown = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ")
    assert(!/\u2014|&mdash;|&#8212;/.test(shown), `${url}: the page shows a long dash: ${shown.match(/.{0,40}(\u2014|&mdash;|&#8212;).{0,40}/)?.[0]}`)
    // The home page and every item page describe themselves for search, and the description parses.
    if (url === "/" || /^\/docs\/[^/]+\/$/.test(url) && !["install", "build-with-ai", "principles", "tokens"].includes(url.split("/")[2])) {
      const ld = html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/)
      assert(ld, `${url}: missing structured data`)
      const types = JSON.parse(ld[1])["@graph"].map((node) => node["@type"])
      assert.deepEqual(types, url === "/" ? ["WebSite", "SoftwareSourceCode"] : ["TechArticle", "BreadcrumbList"], `${url}: structured data`)
    }
  }
  const og = await fetchPage("/og.png")
  assert.equal(og.status, 200)
  assert.equal(og.headers.get("content-type"), "image/png")
  const registry = await fetchPage("/r/button.json", { headers: { origin: "https://ui.shadcn.com" } })
  assert.equal(registry.status, 200)
  checkSecurity(registry)
  assert.equal(registry.headers.get("access-control-allow-origin"), "*")
  assert.equal(registry.headers.get("content-type"), "application/json; charset=utf-8")
  assert.equal(registry.headers.get("cache-control"), "public, max-age=300, must-revalidate")
  assert.equal((await registry.json()).name, "button")
  const registryHead = await fetchPage("/r/registry.json", { method: "HEAD" })
  assert.equal(registryHead.status, 200)
  assert.equal(registryHead.headers.get("access-control-allow-origin"), "*")
  const missing = await fetchPage("/sol-prod-missing-page/")
  assert.equal(missing.status, 404)
  checkSecurity(missing)
  assert.equal(await missing.text(), read("404.html"), "Missing routes must serve the exported 404.")
  const assetPath = read(`${SITE_BASE_PATH.slice(1)}/index.html`).match(/src="([^" ]+\/_next\/static\/[^\"]+\.js)"/)?.[1]
  assert(assetPath, "Home page has no hashed Next script")
  const asset = await fetchPage(assetPath)
  assert.equal(asset.status, 200)
  assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable")

  const sample = [...pages.filter((url) => !url.startsWith("/docs/") && url !== "/specimen/"), "/docs/", "/docs/install/", "/docs/principles/", "/docs/tokens/", "/docs/button/", "/docs/appearance/", "/docs/figure/", "/docs/source/", "/docs/form/", "/docs/dialog/", "/docs/command-line/", "/docs/contour/", "/specimen/", "/404/"]
  browser = await chromium.launch()
  for (const width of [375, 1440]) {
    for (const mode of ["day", "nocturne"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      await fixtureReportingReads(context)
      // Synthetic responses exercise the reporting origins under Chromium's CSP
      // even in an unconfigured build. These probes never reach a real service.
      await context.route("https://feedback.thedirectors.agency/sol-prod-csp-probe", (route) => route.fulfill({ contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: "allowed" }))
      await context.route("https://challenges.cloudflare.com/sol-prod-csp-probe.js", (route) => route.fulfill({ contentType: "text/javascript", body: "window.__cspScriptProbe = true" }))
      await context.route("https://challenges.cloudflare.com/sol-prod-csp-probe.html", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>CSP frame probe</title>" }))
      await context.addInitScript((mode) => {
        localStorage.setItem("0nlytype-theme", JSON.stringify({ mode }))
        window.__cspViolations = []
        document.addEventListener("securitypolicyviolation", (event) => {
          window.__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`)
        })
        new MutationObserver((_, observer) => {
          if (document.body) { window.__modeAtBody = document.documentElement.dataset.mode; observer.disconnect() }
        }).observe(document, { childList: true, subtree: true })
      }, mode)
      const page = await context.newPage()
      let errors = []
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })
      page.on("pageerror", (error) => errors.push(error.message))
      for (const url of sample) {
        errors = []
        try {
          const response = await page.goto(base + sitePath(url), { waitUntil: "networkidle" })
          assert.equal(response.status(), 200)
          if (url === "/") {
            await page.evaluate(async () => {
              const response = await fetch("https://feedback.thedirectors.agency/sol-prod-csp-probe")
              if (await response.text() !== "allowed") throw new Error("Reporting connect-src probe failed")
              const script = document.createElement("script")
              const frame = document.createElement("iframe")
              frame.hidden = true
              const loaded = (element, src) => new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`CSP origin probe timed out: ${src}`)), 3000)
                element.onload = () => { clearTimeout(timer); resolve() }
                element.onerror = () => { clearTimeout(timer); reject(new Error(`CSP origin probe blocked: ${src}`)) }
                element.src = src
                document.body.append(element)
              })
              try {
                await loaded(script, "https://challenges.cloudflare.com/sol-prod-csp-probe.js")
                if (!window.__cspScriptProbe) throw new Error("Turnstile script-src probe failed")
                await loaded(frame, "https://challenges.cloudflare.com/sol-prod-csp-probe.html")
              } finally { script.remove(); frame.remove() }
            })
          }
          const state = await page.evaluate(() => ({ violations: window.__cspViolations, mode: window.__modeAtBody }))
          for (const violation of state.violations) errors.push(`CSP: ${violation}`)
          if (url !== "/specimen/" && state.mode !== mode) errors.push(`Pre-paint theme was ${state.mode}, expected ${mode}`)
        } catch (error) { errors.push(error.message) }
        for (const error of new Set(errors)) failures.push(`${url} @${width} ${mode}: ${error}`)
      }
      await context.close()
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"))
  console.log(`Headers hold: ${pages.length} sitemap pages, canonical metadata, CORS/JSON, cache, 404; ${sample.length} Chromium pages at 375 and 1440 in day and nocturne without CSP violations or console errors.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await browser?.close()
  server.closeAllConnections()
  if (server.listening) await new Promise((resolve) => server.close(resolve))
}
