// Scripted demos start only when the person asks, proved on the packaged site (needs `npm run build`).
//   for EVERY scripted entry in components/site/demo-scores.ts (read from the source, never a fixed list): its docs
//   page offers Demonstrate, nothing moves until it is pressed, pressing runs it, and Stop hands it back
//   the landing's stage does the same for the piece it shows
//   the control works from the keyboard, mirrors in right to left, and stays legible in forced colours
// "Nothing moves until it is pressed" is proved by a detector, not by the player's own published state: from before
// the page's scripts run, a MutationObserver on the example root and capture listeners for synthetic (untrusted)
// click, input, pointer and key events stay on through load, idle, intersection and scrolling into view. Any change
// there, other than the player's own data-demo-* attributes, is an autoplay. After Demonstrate they must see the
// performance; after Stop the example must fall quiet and one real control must still answer a trusted click.
// The detector is itself tested against injected fixtures that autoplay (and one that does not).
// Engines: one run is one engine, MOTION_ENGINE (chromium, firefox or webkit); tests/run-motion.mjs runs all three.
// Chromium sweeps all of the scripted demos. Firefox and WebKit sweep one demo of every script kind (the first scripted
// entry of each kind, in file order), because the full sweep in three engines runs well past the four minutes this
// check is allowed; the keyboard, right-to-left, forced-colours and landing-stage cases run in all three. An engine
// that is missing or cannot launch fails the run; nothing here skips an engine. MOTION_FULL=1 sweeps all of the demos
// in any engine, for a one-off look.
import assert from "node:assert/strict"
import * as playwright from "playwright"

import { DEMO_SCORES } from "../components/site/demo-scores.ts"
import { serveOut } from "../scripts/lib/serve-out.mjs"

const scripted = Object.entries(DEMO_SCORES).filter(([, score]) => score.script).map(([name]) => name)
assert.ok(scripted.length > 0, "no scripted demo found; the gate would pass on nothing")

const engine = process.env.MOTION_ENGINE ?? "chromium"
if (!["chromium", "firefox", "webkit"].includes(engine)) throw new Error(`unknown engine "${engine}"`)
/** One demo of each script kind: every kind of choreography runs in every engine, without sweeping all of them three times. */
const sample = [...new Set(scripted.map((name) => DEMO_SCORES[name].script))].map((kind) => scripted.find((name) => DEMO_SCORES[name].script === kind))
assert.ok(sample.length >= 10, "the cross-engine sample should span at least ten script kinds")


/** Examples that are allowed to move before anyone asks, by name, with the reason. Everything else must wait.
 * `ignore` narrows the allowance to DOM changes under a selector; without it the whole example is allowed.
 * marquee and text-ribbon are not scripted at all (their drift is theirs, with its own pause control), so this
 * check never reaches them; word-relay is scripted, and its relay turns by itself until paused. Owner decision
 * 2026-10-01, recorded in DESIGN.md (Principle 5). Adding a name here needs a reason a reader would accept. */
const AUTOPLAY_ALLOWED = {
  "marquee": { reason: "owner-approved drift with its own pause control; not scripted, so never reached" },
  "text-ribbon": { reason: "owner-approved drift with its own pause control; not scripted, so never reached" },
  "word-relay": { reason: "owner-approved relay that advances by itself until paused (2026-10-01)" },
  "resizable": { reason: "fit titles re-measure and re-set their own width when the page scrolls or resizes; layout only, nothing is performed", ignore: ".ot-resize-title" },
}

/** Runs in the page before any of its scripts. Records, never judges. */
function watchAutoplay({ root: rootSelector, ignore }) {
  const w = (window.__autoplay = { mutations: [], synthetic: [], trusted: [], rooted: false })
  const own = (name) => name && name.startsWith("data-demo-")
  const label = (node) => {
    const el = node.nodeType === 1 ? node : node.parentElement
    return el ? `${el.localName}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}` : "?"
  }
  // The root is found the moment its element is parsed, before its children are. On a busy machine the parser yields
  // in between, and its filling of the root (additions with nothing removed) would read as movement. So records taken
  // while the document is still loading skip those; a script replacing text or nodes still counts.
  const record = (records, parsing) => {
    for (const r of records) {
      if (parsing && r.type === "childList" && r.removedNodes.length === 0) continue
      if (r.type === "attributes" && own(r.attributeName)) continue
      const el = r.target.nodeType === 1 ? r.target : r.target.parentElement
      if (ignore && el && el.closest(ignore)) continue
      w.mutations.push({ at: performance.now(), kind: r.type, target: label(r.target), attribute: r.attributeName })
    }
  }
  const observe = (root) => {
    w.rooted = true
    const observer = new MutationObserver((records) => record(records, document.readyState === "loading"))
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true })
    // readystatechange fires as parsing ends, before the observer's callback; take the parser's last records here.
    if (document.readyState === "loading") document.addEventListener("readystatechange", () => record(observer.takeRecords(), true), { once: true })
  }
  const find = () => { const root = document.querySelector(rootSelector); if (root && !w.rooted) observe(root); return w.rooted }
  if (!find()) {
    const finder = new MutationObserver(() => { if (find()) finder.disconnect() })
    finder.observe(document, { childList: true, subtree: true })
  }
  // An example that scrolls inside itself changes no node. Page scrolling fires on the document, not on an element.
  addEventListener("scroll", (event) => {
    const target = event.target
    if (target && target.nodeType === 1 && document.querySelector(rootSelector)?.contains(target)) w.mutations.push({ at: performance.now(), kind: "scroll", target: label(target), attribute: null })
  }, true)
  const types = ["click", "dblclick", "input", "change", "pointerdown", "pointerup", "pointermove", "pointerover", "pointerenter", "mousedown", "mouseup", "mousemove", "mouseover", "mouseenter", "keydown", "keyup", "keypress", "wheel", "focusin"]
  for (const type of types) {
    addEventListener(type, (event) => {
      const target = event.target
      if (target && target.closest && target.closest("[data-demo-control]")) return
      // Only the example's own events count, as with DOM changes. Chromium sends its own untrusted hover updates
      // to whatever sits under a still cursor when the layout shifts (the site header, at load), which is not a demo.
      if (!event.isTrusted && !document.querySelector(rootSelector)?.contains(target)) return
      const entry = { at: performance.now(), type, target: target && target.nodeType === 1 ? label(target) : String(target) }
      if (event.isTrusted) w.trusted.push({ ...entry, node: target })
      else w.synthetic.push(entry)
    }, true)
  }
}

/** What the detector has seen since the last mark. */
const seen = (page) => page.evaluate(() => ({ mutations: window.__autoplay.mutations.length, synthetic: window.__autoplay.synthetic.length, rooted: window.__autoplay.rooted, first: [...window.__autoplay.mutations, ...window.__autoplay.synthetic][0] ?? null }))
/** Hydration, font loading and fitting legitimately touch the example (state attributes, input types, fitted type)
 * for a moment after the control is offered. Wait until the example has been still for half a second, then count DOM
 * changes from there. One that never settles is moving by itself. Synthetic events are counted from the very start,
 * and the player's published state is checked separately, so a start during this wait is still caught. */
async function settled(page) {
  let last = -1
  for (let waited = 0; waited < 3000; waited += 500) {
    const now = await page.evaluate(() => window.__autoplay.mutations.length)
    if (now === last) { await page.evaluate(() => { window.__autoplay.mutations.length = 0 }); return }
    last = now
    await page.waitForTimeout(500)
  }
  throw new Error("kept changing for 3s after Demonstrate was offered, so it is moving by itself")
}
const mark = (page) => page.evaluate(() => { const w = window.__autoplay; w.mutations.length = 0; w.synthetic.length = 0; w.trusted.length = 0 })
const describeSeen = (r) => `${r.mutations} DOM change(s), ${r.synthetic} synthetic event(s)${r.first ? `, first: ${r.first.kind ?? r.first.type} on ${r.first.target}${r.first.attribute ? ` (${r.first.attribute})` : ""}` : ""}`
/** Throws if anything moved or was dispatched on the example. */
async function assertQuiet(page, when) {
  const r = await seen(page)
  assert.ok(r.rooted, "the detector never found the example root, so it proved nothing")
  assert.ok(r.mutations === 0 && r.synthetic === 0, `moved by itself ${when}: ${describeSeen(r)}`)
}

const site = await serveOut()
const browser = await playwright[engine].launch()
const failures = []
const only = process.env.DEMO_ONLY?.split(",")
const items = only ?? (engine === "chromium" || process.env.MOTION_FULL ? scripted : sample)

/** The control's label follows the published state by a render; wait for it rather than reading it the instant the state changes. */
const labelBecomes = (page, text) => page.waitForFunction((want) => document.querySelector(".doc-demo-controls button")?.textContent?.trim() === want, text, { timeout: 2000, polling: 50 })
  .catch(async () => { throw new Error(`the control should read "${text}" but reads "${(await page.locator(".doc-demo-controls button").first().textContent().catch(() => "")).trim()}"`) })

/** The state the player publishes on the example, and whether a performance has begun. */
const demoState = (page, selector) => page.evaluate((sel) => { const el = document.querySelector(sel); return { state: el?.dataset.demoState ?? null, cycle: el?.dataset.demoCycle ?? null } }, selector)

/** After Stop, whatever was already under way (a dial's spring finishing its last move) may settle, for a few seconds;
 * then the example must be still, and stay still for a second. One that is still moving after the cap is not stopped. */
async function fallsQuiet(page, selector) {
  // A CSS transition changes no DOM while it travels. Its final cleanup can arrive after 600ms of quiet DOM.
  const snapshot = () => page.evaluate((sel) => ({
    count: window.__autoplay.mutations.length + window.__autoplay.synthetic.length,
    moving: document.querySelector(sel)?.getAnimations({ subtree: true }).some((a) =>
      (a.pending || a.playState === "running") && Number.isFinite(a.effect?.getComputedTiming().endTime)),
  }), selector)
  let last = (await snapshot()).count, still = 0
  for (let waited = 0; still < 2; waited += 300) {
    if (waited >= 5000) throw new Error(`still moving ${Math.round(waited / 100) / 10}s after Stop`)
    await page.waitForTimeout(300)
    const now = await snapshot()
    still = now.count === last && !now.moving ? still + 1 : 0
    last = now.count
  }
  await mark(page)
  await page.waitForTimeout(1000)
  await assertQuiet(page, "after Stop, once it had settled")
}

/** Scroll an example into view. A node that hydration or a remount has just replaced is looked up again, not given up on. */
async function reveal(page, selector) {
  for (let attempt = 0; ; attempt++) {
    try { return await page.locator(selector).scrollIntoViewIfNeeded({ timeout: 4000 }) } catch (error) {
      if (attempt >= 3 || !/not attached/.test(error.message)) throw error
      await page.waitForTimeout(200)
    }
  }
}

/** Everything about an example that a reader's touch could change, including what no attribute shows. */
const signature = (page, rootSelector) => page.evaluate((sel) => {
  const root = document.querySelector(sel)
  const fields = [...root.querySelectorAll("input, select, textarea")].map((n) => `${n.checked}/${n.value}`).join(",")
  const scrolled = [...root.querySelectorAll("*")].filter((n) => n.scrollTop || n.scrollLeft).map((n) => `${n.scrollTop}:${n.scrollLeft}`).join(",")
  // What the stylesheet does with the pointer or focus alone (a note revealed on hover) changes no attribute.
  const painted = [...root.querySelectorAll("*")].slice(0, 600).map((n) => { const c = getComputedStyle(n); return `${c.opacity}${c.visibility}${c.transform}${c.fontWeight}${c.color}${c.display}${c.clipPath}` }).join(",")
  return `${root.innerHTML}|${fields}|${scrolled}|${painted}`
}, rootSelector)

/** The middle of every part of the example that can scroll, on screen, for the wheel to be turned over. */
const scrollables = (page, rootSelector) => page.evaluate((sel) => [...document.querySelector(sel).querySelectorAll("*")]
  .filter((n) => n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)
  .filter((n) => ["auto", "scroll"].includes(getComputedStyle(n).overflowY) || ["auto", "scroll"].includes(getComputedStyle(n).overflowX))
  .slice(0, 4).map((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1) } }), rootSelector)

/** After Stop the example is the reader's again: a real control must still answer a trusted click or key press
 * (Playwright sends real input events, isTrusted true). A control that is covered, inert or swallowed by the
 * player fails. Examples with no control of their own (reacting to the pointer, or scrolling) are swept by a real
 * pointer and wheel instead. */
async function answers(page, rootSelector) {
  const candidates = page.locator(`${rootSelector} :is(label:has(input), button, [role="tab"], [role="slider"], [role="separator"], input:not(label input):not([type="hidden"]), select, textarea, summary, figure.ot-melody[tabindex="0"]):not([data-demo-control])`)
  const count = Math.min(await candidates.count(), 8)
  let tried = 0
  for (let i = 0; i < count; i++) {
    const control = candidates.nth(i)
    if (!(await control.isVisible()) || !(await control.isEnabled())) continue
    await control.scrollIntoViewIfNeeded().catch(() => {})
    const box = await control.boundingBox()
    if (!box) continue
    tried++
    // The middle first; a control whose middle is a separator or a gap (a code field's slots) is tried at its ends.
    for (const position of [undefined, { x: 6, y: box.height / 2 }, { x: Math.max(box.width - 6, 1), y: box.height / 2 }]) {
      const was = await signature(page, rootSelector)
      await mark(page)
      try {
        // A native select opens a popup on a click; a real reader changes it with the keyboard, so do that.
        if (await control.evaluate((node) => node.matches("select"))) {
          // ArrowDown changes a closed select in most engines. Firefox leaves it, so type out another option's text:
          // type-ahead picks it in every engine, from the keyboard like a reader would.
          await control.focus()
          await page.keyboard.press("ArrowDown")
          if ((await signature(page, rootSelector)) === was) {
            const text = await control.evaluate((node) => { const now = node.selectedOptions[0]?.text.trim(); return [...node.options].map((o) => o.text.trim()).find((t) => t && t !== now) ?? "" })
            if (text) await page.keyboard.type(text)
          }
        }
        // Melody is a focusable figure: its documented control is Enter, not a button or a wide pointer target.
        else if (await control.evaluate((node) => node.matches("figure.ot-melody[tabindex='0']"))) {
          await control.focus()
          await page.keyboard.press("Enter")
        }
        else await control.click({ timeout: 1000, force: true, position })
        if (await control.evaluate((node) => node.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea'))) await page.keyboard.type("1")
        else if (await control.evaluate((node) => node.matches('[role="slider"], [role="separator"]'))) await page.keyboard.press("ArrowRight")
      } catch { continue }
      await page.waitForTimeout(100)
      const reached = await page.evaluate((sel) => window.__autoplay.trusted.some((t) => t.node && document.querySelector(sel)?.contains(t.node)), rootSelector)
      if (reached && ((await signature(page, rootSelector)) !== was || (await seen(page)).mutations > 0)) return
    }
  }
  // An example that has controls must answer through one of them. One with none (it reacts to the pointer, or it
  // scrolls) is swept by a real pointer and wheel instead.
  if (tried > 0) throw new Error(`none of its ${tried} controls answered a trusted click or key press after Stop`)
  const was = await signature(page, rootSelector)
  await mark(page)
  const box = await page.locator(rootSelector).boundingBox()
  if (box) {
    await reveal(page, rootSelector)
    // Pointer handlers need a moment between moves, and a loaded machine can drop a fast sweep: sweep up to three times.
    for (let attempt = 0; attempt < 3; attempt++) {
      const view = (await page.locator(rootSelector).boundingBox()) ?? box
      const top = Math.max(view.y, 0), height = Math.min(view.height, 700)
      for (const fy of [0.2, 0.5, 0.8]) {
        for (let step = 0; step <= 12; step++) { await page.mouse.move(view.x + (view.width * step) / 12, top + height * fy, { steps: 2 }); await page.waitForTimeout(15) }
      }
      for (const target of await scrollables(page, rootSelector)) {
        await page.mouse.move(target.x, target.y)
        await page.mouse.wheel(0, 60)
        await page.mouse.wheel(60, 0)
      }
      await page.waitForTimeout(150)
      const reached = await page.evaluate(() => window.__autoplay.trusted.length > 0)
      if (reached && ((await signature(page, rootSelector)) !== was || (await seen(page)).mutations > 0)) return
    }
  }
  throw new Error("it has no control, and a real pointer sweep and wheel changed nothing after Stop")
}

async function one(context, item) {
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  const example = `[data-demo-item="${item}"]`
  const allowed = AUTOPLAY_ALLOWED[item]
  const exempt = allowed && !allowed.ignore
  await page.addInitScript(watchAutoplay, { root: example, ignore: allowed?.ignore ?? null })
  try {
    await page.goto(site.url(`/docs/${item}/`), { waitUntil: "load" })
    await page.waitForSelector(example, { timeout: 10000 })
    await reveal(page, example)
    const control = page.locator(".doc-demo-controls button")
    assert.equal(await control.count(), 1, "no Demonstrate control on the page")
    assert.equal((await control.textContent()).trim(), "Demonstrate")
    // Available once it has been looked at (load, idle, in view). Then give an eager player every chance to start:
    // idle, and scrolled out of view and back into it.
    await page.waitForFunction(() => { const b = document.querySelector(".doc-demo-controls button"); return b && !b.disabled }, null, { timeout: 10000 })
    await settled(page)
    for (let i = 0; i < 8; i++) {
      const { state, cycle } = await demoState(page, example)
      assert.ok(!["playing", "finished", "stopped"].includes(state) && cycle === null, `started by itself (${state}, cycle ${cycle})`)
      if (i === 2) await page.evaluate(() => scrollTo(0, 0))
      if (i === 4) await reveal(page, example)
      await page.waitForTimeout(250)
    }
    if (!exempt) await assertQuiet(page, "before Demonstrate was pressed (load, idle, intersection, scrolling into view)")
    // Pressed, it plays and the detector sees it; Stop hands it back and the control is Demonstrate again.
    await mark(page)
    await control.click()
    await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.demoState === "playing", example, { timeout: 5000 })
    await labelBecomes(page, "Stop")
    await page.waitForFunction(() => window.__autoplay.mutations.length + window.__autoplay.synthetic.length > 0, null, { timeout: 5000 }).catch(() => { throw new Error("Demonstrate played, but the detector saw no change or event on the example") })
    await control.click()
    await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.demoState === "stopped", example, { timeout: 2000 })
    await labelBecomes(page, "Demonstrate")
    assert.equal((await demoState(page, example)).state, "stopped")
    // After Stop: let any settling finish, then nothing may move, and a real control must still answer.
    if (!exempt) {
      await fallsQuiet(page, example)
    }
    await answers(page, example)
    assert.ok(errors.length === 0, `page error: ${errors[0]}`)
  } finally { await page.close() }
}

/** The detector must itself be able to fail. Each fixture is a one-component page that autoplays in a different
 * way, or does not; the same watcher, quiet window and real-control probe judge it as judge the real examples. */
async function selfTest(browser) {
  const fixtures = {
    "quiet": { script: "", quiet: true },
    "text changes on a timer": { script: "setTimeout(() => { document.getElementById('t').textContent = '1' }, 300)" },
    "attribute changes on a timer": { script: "setTimeout(() => { document.getElementById('b').setAttribute('aria-pressed', 'true') }, 300)" },
    "node added on a timer": { script: "setTimeout(() => { document.getElementById('r').append(document.createElement('i')) }, 300)" },
    "synthetic click, no change": { script: "setTimeout(() => document.getElementById('b').dispatchEvent(new MouseEvent('click', { bubbles: true })), 300)" },
    "synthetic input event": { script: "setTimeout(() => { const i = document.getElementById('i'); i.dispatchEvent(new Event('input', { bubbles: true })) }, 300)" },
    "synthetic pointer move": { script: "setTimeout(() => document.getElementById('b').dispatchEvent(new PointerEvent('pointermove', { bubbles: true })), 300)" },
    "synthetic key": { script: "setTimeout(() => document.getElementById('i').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })), 300)" },
    "late, only after the first second": { script: "setTimeout(() => { document.getElementById('t').textContent = '2' }, 1300)" },
    "on a repeating timer": { script: "setInterval(() => { document.getElementById('t').textContent = String(Math.random()) }, 400)" },
    "synthetic hover outside the example": { script: "setTimeout(() => document.body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })), 300)", quiet: true },
    "starts when scrolled into view": { script: "new IntersectionObserver((e) => { if (e[0].isIntersecting) document.getElementById('t').textContent = 'seen' }).observe(document.getElementById('r'))" },
  }
  const html = (script, cover) => `<!doctype html><title>fixture</title><body style="margin:0"><div id="r" data-demo-item="fixture" style="padding:40px"><span id="t">0</span> <button id="b">Do</button> <input id="i"></div>${cover ? '<div style="position:fixed;inset:0"></div>' : ""}<script>${script}</script></body>`
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } })
  const problems = []
  for (const [name, fixture] of Object.entries(fixtures)) {
    const page = await context.newPage()
    try {
      await page.route("**/fixture", (route) => route.fulfill({ contentType: "text/html", body: html(fixture.script) }))
      await page.addInitScript(watchAutoplay, { root: '[data-demo-item="fixture"]', ignore: null })
      await page.goto("http://fixture.test/fixture")
      await page.waitForTimeout(1800)
      let caught = null
      await assertQuiet(page, "(fixture)").catch((error) => { caught = error })
      if (fixture.quiet && caught) problems.push(`self-test: the quiet fixture was reported as moving: ${caught.message}`)
      if (!fixture.quiet && !caught) problems.push(`self-test: the detector did not catch an autoplay that was ${name}`)
    } catch (error) { problems.push(`self-test (${name}): ${error.message.split("\n")[0]}`) } finally { await page.close() }
  }
  // The real-control probe must fail on a covered example, and pass on an ordinary one.
  for (const [name, cover] of [["a covered example", true], ["an open example", false]]) {
    const page = await context.newPage()
    try {
      await page.route("**/fixture", (route) => route.fulfill({ contentType: "text/html", body: html("document.getElementById('b').onclick = () => { document.getElementById('t').textContent = 'x' }", cover) }))
      await page.addInitScript(watchAutoplay, { root: '[data-demo-item="fixture"]', ignore: null })
      await page.goto("http://fixture.test/fixture")
      let caught = null
      await answers(page, '[data-demo-item="fixture"]').catch((error) => { caught = error })
      if (cover && !caught) problems.push(`self-test: the real-control probe passed on ${name}`)
      if (!cover && caught) problems.push(`self-test: the real-control probe failed on ${name}: ${caught.message}`)
    } catch (error) { problems.push(`self-test (${name}): ${error.message.split("\n")[0]}`) } finally { await page.close() }
  }
  // A last committed move may settle after Stop. Quiet DOM alone must not mistake its completion for autoplay.
  const finishing = await context.newPage()
  try {
    await finishing.route("**/fixture", (route) => route.fulfill({ contentType: "text/html", body: html("", false) }))
    await finishing.addInitScript(watchAutoplay, { root: '[data-demo-item="fixture"]', ignore: null })
    await finishing.goto("http://fixture.test/fixture")
    await finishing.evaluate(() => {
      const t = document.getElementById("t")
      t.animate([{ opacity: 1 }, { opacity: 0.5 }], { duration: 1000 }).finished.then(() => { t.textContent = "landed" })
    })
    await fallsQuiet(finishing, '[data-demo-item="fixture"]')
    assert.equal(await finishing.locator("#t").textContent(), "landed")
  } catch (error) { problems.push(`self-test (a finishing transition): ${error.message}`) } finally { await finishing.close() }
  await context.close()
  return problems
}

// Docs pages, a few at a time (each is a full page; the laptop is small).
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
failures.push(...(await selfTest(browser)))
const queue = [...items]
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let item = queue.shift(); item; item = queue.shift()) {
    try { await one(context, item) } catch (error) { failures.push(`${item}: ${error.message.split("\n")[0]}`) }
  }
}))

// One run to the end: Demonstrate plays a single bounded pass and finishes by itself.
for (const item of only ? [] : ["toggle", "accordion", "tabs"]) {
  const page = await context.newPage()
  try {
    await page.goto(site.url(`/docs/${item}/`))
    await page.waitForFunction(() => { const b = document.querySelector(".doc-demo-controls button"); return b && !b.disabled }, null, { timeout: 10000 })
    await page.locator(".doc-demo-controls button").click()
    await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.demoState === "finished", `[data-demo-item="${item}"]`, { timeout: 30000 })
    await labelBecomes(page, "Demonstrate")
  } catch (error) { failures.push(`${item} (to the end): ${error.message.split("\n")[0]}`) } finally { await page.close() }
}

// Keyboard, right to left, forced colours.
if (!only) {
  const page = await context.newPage()
  try {
    await page.goto(site.url("/docs/toggle/"))
    await page.waitForFunction(() => { const b = document.querySelector(".doc-demo-controls button"); return b && !b.disabled })
    const geometry = () => page.evaluate(() => { const r = document.querySelector(".doc-demo-controls button").getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth, height: r.height } })
    const ltr = await geometry()
    assert.ok(ltr.height >= 40, "the control is too small to hit")
    await page.evaluate(() => { document.documentElement.dir = "rtl" })
    const rtl = await geometry()
    assert.ok(rtl.left >= 0 && rtl.right <= rtl.width && rtl.left < ltr.left, "the control should mirror to the other side and stay on screen")
    await page.evaluate(() => { document.documentElement.dir = "ltr" })
    // Keyboard: Tab to it, Space starts, Space again stops.
    await page.evaluate(() => document.querySelector(".doc-demo-controls button").focus())
    await page.keyboard.press("Space")
    await page.waitForFunction(() => document.querySelector('[data-demo-item="toggle"]').dataset.demoState === "playing", null, { timeout: 5000 })
    await page.keyboard.press("Space")
    await page.waitForFunction(() => document.querySelector('[data-demo-item="toggle"]').dataset.demoState === "stopped", null, { timeout: 2000 })
    // Forced colours: the label is painted in a system colour on the system canvas, never invisible.
    await page.emulateMedia({ forcedColors: "active" })
    const paint = await page.evaluate(() => { const b = document.querySelector(".doc-demo-controls button"); const s = getComputedStyle(b); return { color: s.color, background: s.backgroundColor, width: b.getBoundingClientRect().width } })
    assert.ok(paint.width > 0 && paint.color !== paint.background, `forced colours: ${paint.color} on ${paint.background}`)
  } catch (error) { failures.push(`control (keyboard, rtl, forced colours): ${error.message.split("\n")[0]}`) } finally { await page.close() }
}
await context.close()

await browser.close()
await site.close()
if (failures.length) { console.error(failures.map((f) => `- ${f}`).join("\n")); process.exit(1) }
console.log(`Demo player browser check passed in ${engine}: ${items.length} of ${scripted.length} scripted demos stay quiet until Demonstrate, are seen to run, fall quiet on Stop and hand a real control back; the detector catches every injected autoplay${only ? "" : "; keyboard, right to left and forced colours hold"}.`)
