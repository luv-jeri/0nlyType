// Motion, proved in a browser on the packaged site (needs `npm run build`; the check starts and stops its own server).
//   the home overture: plays once per browser, ends by one deadline under three seconds, skips by key, press and
//   control, survives late fonts and unavailable storage, and is static under reduced motion
//   docs titles stay still, nothing logs an error
//   01, the tunnel: a fast scroll turns it and its reading never holds more than two copies, the keyboard turns it
//   through a real list, and reduced motion has it settled
// One run is one engine in one colour scheme: MOTION_ENGINE (chromium, firefox or webkit) and MOTION_SCHEME (light is
// day, dark is nocturne). tests/run-motion.mjs runs all six. An engine that is not installed or cannot launch fails
// the run; nothing here skips an engine.
import assert from "node:assert/strict"
import * as playwright from "playwright"

import { OVERTURE_ATTR, OVERTURE_DEADLINE, OVERTURE_KEY } from "../lib/site/overture.mjs"
import { serveOut } from "../scripts/lib/serve-out.mjs"

const engine = process.env.MOTION_ENGINE ?? "chromium"
const scheme = process.env.MOTION_SCHEME ?? "light"
if (!["chromium", "firefox", "webkit"].includes(engine)) throw new Error(`unknown engine "${engine}"`)
if (!["light", "dark"].includes(scheme)) throw new Error(`unknown colour scheme "${scheme}"`)

const site = await serveOut()
const browser = await playwright[engine].launch()
const failures = []
let ran = 0

/** Watches the overture attribute from before the page's own scripts: when it appeared, and when it went. */
const spy = (attr) => {
  window.__overture = { starts: [], ends: [], moving: [] }
  // Whether the hands' letters were seen rising, sampled from the start while the overture plays, so the answer does
  // not depend on how soon a test looks. The hands are drawn on canvases once the page's script runs, which marks them
  // data-drawn, and data-rising while the overture's clock draws them; until then there is nothing.
  const sample = setInterval(() => {
    const log = window.__overture
    if (log.starts.length && !log.ends.length) {
      const hands = document.querySelector(".zero-hands[data-drawn]")
      if (hands) log.moving.push(hands.hasAttribute("data-rising"))
    }
    if (log.ends.length) clearInterval(sample)
  }, 30)
  new MutationObserver(() => {
    const value = document.documentElement.getAttribute(attr)
    const log = window.__overture
    if (value !== null && !log.starts.length) log.starts.push({ at: Number(value), seen: performance.now() })
    if (value === null && log.starts.length && !log.ends.length) log.ends.push(performance.now())
  }).observe(document, { attributes: true, subtree: true, attributeFilter: [attr] })
}

async function fresh(options = {}, init) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, ...options })
  await context.addInitScript(spy, OVERTURE_ATTR)
  if (init) await context.addInitScript(init)
  const errors = []
  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  })
  return { context, errors }
}
const log = (page) => page.evaluate(() => window.__overture)
// Polled on a timer, not on animation frames: a page that has not painted yet (WebKit holds its first paint while
// scripts are pending) gets no frames, and the overture's clock does not need any.
const started = (page, timeout = 10000) => page.waitForFunction(() => window.__overture?.starts.length > 0, null, { timeout, polling: 50 })
const ended = (page, timeout = 6000) => page.waitForFunction(() => window.__overture.ends.length > 0, null, { timeout, polling: 50 })
// Tab to Skip intro. Safari and WebKit skip buttons on Tab unless the system says otherwise; Option+Tab visits every
// control there, so the keyboard path is walked with the key each engine uses.
async function tabToSkip(page) {
  const key = engine === "webkit" ? "Alt+Tab" : "Tab"
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press(key)
    if (await page.evaluate(() => document.activeElement?.classList.contains("hero-skip"))) return true
  }
  return false
}
// At rest: the hands, if drawn, are drawn settled (every letter in place, not rising on the overture's clock), and the
// dots are not animating on a clock and stand at the opacity the page gives them: lit, unless the zero is too small to
// carry its names, when the index dot fades out with them. The hands' step away is tied to the scroll (a scroll
// timeline, never a clock), so at the top of the page they stand where they were set.
const rest = (page) => page.evaluate(() => !document.querySelector(".zero-hands")?.hasAttribute("data-rising") && [...document.querySelectorAll(".zero-ring :is(.index-dot, .mk-dot)")].every((el) => { const s = getComputedStyle(el); const clock = s.animationName !== "none" && !/^--/.test(s.animationTimeline ?? ""); return !clock && Math.abs(Number(s.opacity) - Number(el.style.opacity || 1)) < 0.01 }))

async function check(name, fn) {
  ran++
  try { await fn() } catch (error) { failures.push(`${name}: ${error.message.split("\n")[0]}`) }
}

// ── the first visit ──
await check("first visit: plays, ends by the deadline, records itself once", async () => {
  const { context, errors } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  assert.ok(await page.locator(".hero-skip").isVisible(), "Skip intro should be visible while it plays")
  await ended(page)
  const { starts, ends, moving } = await log(page)
  assert.ok(moving.length > 0, "the hands were never drawn while the overture played")
  assert.ok(moving.some(Boolean), "the hands' letters should rise into place while it plays")
  const took = ends[0] - starts[0].at
  assert.ok(took <= OVERTURE_DEADLINE + 150, `title and field ended after ${Math.round(took)}ms, past the ${OVERTURE_DEADLINE}ms deadline`)
  assert.ok(took < 3000)
  assert.ok(await rest(page), "the hands and the dot should rest once it ends")
  assert.equal(await page.locator(".hero-skip").isVisible(), false, "Skip intro should be gone after the overture")
  assert.equal(await page.evaluate((k) => localStorage.getItem(k), OVERTURE_KEY), "1")
  assert.deepEqual(errors, [])
  await context.close()
})

await check("later visits arrive settled: reload, another tab, back", async () => {
  const { context } = await fresh()
  const first = await context.newPage()
  await first.goto(site.url("/"))
  await ended(first)
  for (const how of ["reload", "tab", "back"]) {
    const page = how === "tab" ? await context.newPage() : first
    if (how === "reload") await page.reload()
    if (how === "tab") await page.goto(site.url("/"))
    if (how === "back") { await page.goto(site.url("/docs/")); await page.goBack() }
    await page.waitForSelector("#hero-title")
    await page.waitForTimeout(500)
    const { starts } = await log(page)
    assert.equal(starts.length, 0, `the overture replayed after ${how}`)
    assert.ok(await rest(page), "the hands should be at rest")
    assert.equal(await page.locator(".hero-skip").isVisible(), false)
  }
  await context.close()
})

await check("Escape ends it", async () => {
  const { context } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  await page.keyboard.press("Escape")
  await ended(page, 500)
  assert.ok(await rest(page), "the hands should be at rest")
  await context.close()
})

await check("a press ends it", async () => {
  const { context } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  await page.mouse.click(700, 520)
  await ended(page, 500)
  await context.close()
})

await check("the wheel ends it", async () => {
  const { context } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  await page.mouse.move(700, 520)
  await page.mouse.wheel(0, 120)
  await ended(page, 500)
  await context.close()
})

await check("Skip intro is reachable by keyboard and hands focus on to the first action", async () => {
  const { context } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  assert.ok(await tabToSkip(page), "Tab never reached Skip intro")
  assert.equal((await log(page)).ends.length, 0, "Tab alone must not end the overture")
  await page.keyboard.press("Enter")
  await ended(page, 500)
  assert.equal(await page.evaluate(() => document.activeElement?.closest(".hero-cta") !== null), true, "focus should move on to the first action")
  await context.close()
})

await check("Skip intro by pointer", async () => {
  const { context } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  await page.locator(".hero-skip").click()
  await ended(page, 500)
  await context.close()
})

await check("Skip intro mirrors in right to left and stays on screen", async () => {
  const { context } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  const place = () => page.evaluate(() => { const r = document.querySelector(".hero-skip").getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth } })
  const ltr = await place()
  await page.evaluate(() => { document.documentElement.dir = "rtl" })
  const rtl = await place()
  assert.ok(ltr.right <= ltr.width && rtl.left >= 0, "Skip intro left the screen")
  // It stands on the page's axis, in the zero's counter: mirrored, its middle lands width minus where it was.
  const mid = (r) => (r.left + r.right) / 2
  assert.ok(Math.abs(mid(rtl) - (rtl.width - mid(ltr))) <= 1, "Skip intro should mirror about the page's axis in right to left")
  await context.close()
})

await check("the deadline holds when fonts arrive late", async () => {
  const { context } = await fresh()
  await context.route("**/*.woff2", async (route) => { await new Promise((r) => setTimeout(r, 3500)); await route.continue() })
  const page = await context.newPage()
  await page.goto(site.url("/"), { waitUntil: "commit" })
  await started(page, 8000)
  await ended(page, 8000)
  const { starts, ends } = await log(page)
  assert.ok(ends[0] - starts[0].at <= OVERTURE_DEADLINE + 150, "late fonts stretched the overture")
  await context.close()
})

// ── the clock belongs to the page's own script, not to React ──
// The inline script ends the overture itself, so these hold while the framework's JavaScript is slow or absent.
const hydrated = (page) => page.evaluate(() => [...document.querySelectorAll(".hero-skip, #hero-title")].some((el) => Object.keys(el).some((k) => k.startsWith("__reactFiber"))))
const holdFrameworkJs = (context, ms) => context.route("**/_next/**/*.js", async (route) => { await new Promise((r) => setTimeout(r, ms)); await route.continue() })

await check("slow JavaScript: the deadline still ends it, before React has loaded", async () => {
  const { context, errors } = await fresh()
  await holdFrameworkJs(context, 5000)
  const page = await context.newPage()
  await page.goto(site.url("/"), { waitUntil: "domcontentloaded" })
  await started(page)
  await ended(page, 3500)
  const { starts, ends } = await log(page)
  assert.ok(ends[0] - starts[0].at <= OVERTURE_DEADLINE + 150, `ended after ${Math.round(ends[0] - starts[0].at)}ms with React held back`)
  assert.equal(await hydrated(page), false, "React had already loaded; this case proves nothing")
  assert.ok(await rest(page), "the hands should be at rest")
  assert.equal(await page.locator(".hero-skip").isVisible(), false)
  await context.close()
  assert.deepEqual(errors.filter((e) => !/Failed to load|net::/.test(e)), [])
})

await check("slow JavaScript: a key ends it before React has loaded", async () => {
  const { context } = await fresh()
  await holdFrameworkJs(context, 5000)
  const page = await context.newPage()
  await page.goto(site.url("/"), { waitUntil: "domcontentloaded" })
  await started(page)
  await page.keyboard.press("Escape")
  await ended(page, 500)
  assert.equal(await hydrated(page), false)
  await context.close()
})

await check("slow JavaScript: Skip intro works by keyboard before React has loaded", async () => {
  const { context } = await fresh()
  await holdFrameworkJs(context, 5000)
  const page = await context.newPage()
  await page.goto(site.url("/"), { waitUntil: "domcontentloaded" })
  await started(page)
  assert.ok(await tabToSkip(page), "Tab never reached Skip intro")
  assert.equal((await log(page)).ends.length, 0, "Tab alone must not end the overture")
  await page.keyboard.press("Enter")
  await ended(page, 500)
  assert.equal(await hydrated(page), false)
  assert.equal(await page.evaluate(() => document.activeElement?.closest(".hero-cta") !== null), true, "focus should move on to the first action")
  await context.close()
})

await check("slow JavaScript: Skip intro works by pointer before React has loaded", async () => {
  const { context } = await fresh()
  await holdFrameworkJs(context, 5000)
  const page = await context.newPage()
  await page.goto(site.url("/"), { waitUntil: "domcontentloaded" })
  await started(page)
  // A real mouse press on the control's own box. locator.click() waits for animation frames, and WebKit presents none
  // while the framework's scripts are held, so it would wait for the very thing this case takes away.
  const box = await page.locator(".hero-skip").boundingBox()
  assert.ok(box && box.width > 0, "Skip intro has no box before React has loaded")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await ended(page, 500)
  assert.equal(await hydrated(page), false)
  await context.close()
})

await check("JavaScript blocked entirely: no overture starts and the page is complete", async () => {
  const { context } = await fresh({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await page.waitForSelector("#hero-title")
  await page.waitForTimeout(600)
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-overture-at")), false)
  assert.ok(await rest(page), "the hands should be at rest")
  assert.equal(await page.locator(".hero-skip").isVisible(), false)
  assert.ok(await page.locator("h1").isVisible())
  await context.close()
})

await check("framework scripts that fail to load: the overture still ends at the deadline", async () => {
  const { context } = await fresh()
  await context.route("**/_next/**/*.js", (route) => route.abort())
  const page = await context.newPage()
  await page.goto(site.url("/"), { waitUntil: "domcontentloaded" })
  await started(page)
  await ended(page, 3500)
  const { starts, ends } = await log(page)
  assert.ok(ends[0] - starts[0].at <= OVERTURE_DEADLINE + 150)
  assert.ok(await rest(page), "the hands should be at rest")
  await context.close()
})

// ── when the overture must not play ──
const never = (name, options, init, extra) => check(name, async () => {
  const { context, errors } = await fresh(options, init)
  const page = await context.newPage()
  await page.goto(site.url(extra?.route ?? "/"))
  await page.waitForSelector("#hero-title")
  await page.waitForTimeout(600)
  assert.equal((await log(page)).starts.length, 0, "the overture played")
  assert.equal(await page.locator(".hero-skip").isVisible(), false)
  assert.ok(await rest(page), "the hands should be at rest")
  assert.ok(await page.locator("h1").isVisible(), "the page should still render")
  if (extra?.stored !== undefined) assert.equal(await page.evaluate((k) => localStorage.getItem(k), OVERTURE_KEY), extra.stored)
  assert.deepEqual(errors, [])
  await context.close()
})
await never("reduced motion: static, complete, and counted as seen", { reducedMotion: "reduce" }, null, { stored: "1" })
await never("storage that refuses to be read: arrives settled", {}, () => {
  Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError") } })
})
await never("storage that refuses to be written: arrives settled", {}, () => {
  Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError") }
})
await never("a link to a part of the page: arrives settled", {}, null, { route: "/#tune", stored: "1" })

await check("reduced motion asked for mid-way ends it", async () => {
  const { context } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await ended(page, 500)
  assert.ok(await rest(page), "the hands should be at rest")
  await context.close()
})

// ── docs titles ──
await check("docs titles stay still", async () => {
  const { context, errors } = await fresh()
  const page = await context.newPage()
  await page.goto(site.url("/docs/button/"))
  await page.waitForSelector(".doc-title")
  for (const y of [0, 300, 900]) {
    await page.evaluate((top) => scrollTo(0, top), y)
    await page.waitForTimeout(150)
    const state = await page.evaluate(() => { const t = document.querySelector(".doc-title"); const s = getComputedStyle(t); return { name: s.animationName, tracking: s.letterSpacing, running: t.getAnimations().length } })
    assert.equal(state.name, "none")
    assert.equal(state.running, 0)
  }
  assert.deepEqual(errors, [])
  await context.close()
})

// ── phones: a touch screen, a coarse pointer ──
// Firefox has no mobile emulation (no isMobile), but still takes a touch screen; the cases below use touch either way.
const phone = (width, height) => ({ viewport: { width, height }, hasTouch: true, isMobile: engine !== "firefox" })

await check("the home page logs no error at 375, first visit and after", async () => {
  const { context, errors } = await fresh(phone(375, 800))
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await page.waitForTimeout(2600)
  await page.reload()
  await page.waitForTimeout(600)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(over <= 1, `sideways overflow of ${over}px`)
  assert.deepEqual(errors, [])
  await context.close()
})

await check("667px, coarse pointer: plays, ends at the deadline, no sideways overflow", async () => {
  const { context, errors } = await fresh(phone(667, 375))
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  if (engine !== "firefox") assert.equal(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), true, "the context should have a coarse pointer")
  assert.ok(await page.locator(".hero-skip").isVisible(), "Skip intro should be visible while it plays")
  await ended(page)
  const { starts, ends } = await log(page)
  assert.ok(ends[0] - starts[0].at <= OVERTURE_DEADLINE + 150, `ended after ${Math.round(ends[0] - starts[0].at)}ms`)
  assert.ok(await rest(page), "the hands should be at rest")
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(over <= 1, `sideways overflow of ${over}px`)
  assert.deepEqual(errors, [])
  await context.close()
})

await check("667px, coarse pointer: a tap on the page ends it", async () => {
  const { context } = await fresh(phone(667, 375))
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  await page.touchscreen.tap(333, 120)
  await ended(page, 500)
  assert.ok(await rest(page), "the hands should be at rest")
  await context.close()
})

await check("667px, coarse pointer: a tap on Skip intro ends it, and it is big enough to hit", async () => {
  const { context } = await fresh(phone(667, 375))
  const page = await context.newPage()
  await page.goto(site.url("/"))
  await started(page)
  const box = await page.locator(".hero-skip").boundingBox()
  assert.ok(box && box.height >= 40 && box.width >= 40, `Skip intro is ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}px`)
  await page.locator(".hero-skip").tap()
  await ended(page, 500)
  await context.close()
})

await check("667px, coarse pointer: reload and a new tab arrive settled", async () => {
  const { context } = await fresh(phone(667, 375))
  const first = await context.newPage()
  await first.goto(site.url("/"))
  await ended(first)
  for (const how of ["reload", "tab"]) {
    const page = how === "tab" ? await context.newPage() : first
    if (how === "reload") await page.reload()
    else await page.goto(site.url("/"))
    await page.waitForSelector("#hero-title")
    await page.waitForTimeout(400)
    assert.equal((await log(page)).starts.length, 0, `the overture replayed after ${how}`)
    assert.ok(await rest(page), "the hands should be at rest")
  }
  await context.close()
})

// ── 01, the tunnel: the scroll turns it, the list reads it, and it is settled under reduced motion ──
// Seeded only on the site's own pages: Chromium also runs it on the blank page it opens first, where storage throws.
const seen = `if (location.protocol.startsWith("http")) localStorage.setItem(${JSON.stringify(OVERTURE_KEY)}, "1")`
// Down to the tunnel, a few pieces in, and wait for it to read.
async function toTunnel(page, pieces = 30) {
  await page.goto(site.url("/"))
  await page.waitForSelector(".tunnel-ring textPath.on", { state: "attached" })
  await page.evaluate((n) => scrollTo(0, document.querySelector(".zero").getBoundingClientRect().top + scrollY + innerHeight * 0.75 + 20 + n * 24), pieces)
  await page.waitForFunction(() => document.querySelector(".zero-stage")?.hasAttribute("data-dial"), null, { polling: 50 })
  await page.waitForTimeout(1200)
}
// The reading, the ring and the list say the same piece.
const reading = (page) => page.evaluate(() => {
  const boxes = [...document.querySelectorAll("[data-swap]")]
  const on = document.querySelector(".tunnel-ring textPath.on"), current = document.querySelector(".pieces-list a[aria-current]")
  return { copies: boxes.map((b) => b.children.length), on: on?.getAttribute("data-i"), current: current?.dataset.i, name: document.querySelector('[data-swap="name"] > :not(.out)')?.textContent, title: current?.textContent }
})

await check("01: a fast scroll turns the tunnel, and the reading never holds more than two copies", async () => {
  const { context, errors } = await fresh({}, seen)
  const page = await context.newPage()
  await toTunnel(page)
  await page.mouse.move(1100, 450)
  await page.evaluate(() => {
    window.__most = 0
    window.__watch = true
    const f = () => {
      for (const box of document.querySelectorAll("[data-swap]")) window.__most = Math.max(window.__most, box.children.length)
      if (window.__watch) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  })
  const before = await reading(page)
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 48)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(1500)
  const most = await page.evaluate(() => (window.__watch = false, window.__most))
  assert.ok(most <= 2, `a reading box held ${most} copies`)
  const after = await reading(page)
  assert.notEqual(after.on, before.on, "the scroll did not turn the tunnel")
  assert.deepEqual(after.copies, [1, 1, 1, 1], "the reading should settle to one copy of each part")
  assert.equal(after.on, after.current, "the ring and the list should read the same piece")
  assert.ok(after.title?.includes(after.name ?? "\0"), `the reading says "${after.name}", the list "${after.title}"`)
  assert.deepEqual(errors, [], `the page logged: ${errors.join(" | ")}`)
  await context.close()
})

await check("01: the pieces are a list of links the keyboard turns; the drawing is hidden from it", async () => {
  const { context, errors } = await fresh({}, seen)
  const page = await context.newPage()
  await toTunnel(page)
  assert.equal(await page.locator('nav[aria-label="Every piece"] ol > li > a').count(), 105)
  assert.equal(await page.locator(".zero-tunnel").getAttribute("aria-hidden"), "true")
  assert.equal(await page.locator(".pieces-skip a", { hasText: "Skip the index" }).getAttribute("href"), "#leaves")
  assert.equal(await page.locator(".pieces-skip a", { hasText: "Every piece as a list" }).count(), 1)
  const from = Number((await reading(page)).current)
  await page.locator(".pieces-list a[tabindex='0']").focus()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await page.waitForTimeout(1500)
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), String(from + 2), "the arrows should move the focus along the list")
  const after = await reading(page)
  assert.equal(after.on, String(from + 2), "the arrows should turn the tunnel to the focused piece")
  assert.equal(after.current, after.on)
  assert.deepEqual(errors, [], `the page logged: ${errors.join(" | ")}`)
  await context.close()
})

await check("01 under reduced motion: settled at once, and it still reads", async () => {
  const { context, errors } = await fresh({ reducedMotion: "reduce" }, seen)
  const page = await context.newPage()
  await toTunnel(page)
  const turns = () => page.evaluate(() => [...document.querySelectorAll(".tunnel-ring, .tunnel-disc, .tunnel-dot")].map((el) => `${el.style.transform}|${el.style.opacity}`))
  const a = await turns()
  await page.waitForTimeout(300)
  assert.deepEqual(await turns(), a, "nothing in the tunnel should move once the scroll stops")
  assert.equal(await page.locator(".tunnel-dot").evaluate((el) => Number(el.style.opacity)), 1, "the tunnel should stand fully arrived")
  await page.locator(".pieces-list a[tabindex='0']").focus()
  await page.keyboard.press("ArrowDown")
  await page.waitForTimeout(300)
  const r = await reading(page)
  assert.deepEqual(r.copies, [1, 1, 1, 1], "the reading should change over at once, one copy each")
  assert.equal(r.on, r.current)
  assert.equal(await page.evaluate(() => document.querySelector(".readout").getAnimations({ subtree: true }).filter((x) => x.playState === "running").length), 0, "nothing in the reading should animate")
  assert.deepEqual(errors, [], `the page logged: ${errors.join(" | ")}`)
  await context.close()
})

await browser.close()
await site.close()
if (failures.length) { console.error(failures.map((f) => `- ${f}`).join("\n")); process.exit(1) }
console.log(`Motion browser check passed: ${ran} cases (the home overture lifecycle, docs titles, the tunnel in 01) in ${engine}, ${scheme === "dark" ? "nocturne" : "day"}.`)
