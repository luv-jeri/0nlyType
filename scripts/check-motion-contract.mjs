// Holds the motion rules to the source, before the build. Motion that starts by itself is a failure here, not a note.
//   scripted demos: every one waits for the person (one explicit start, nothing synthesised by discovery)
//   the home overture: one key, one deadline under three seconds, every move of the hands and the dot gated by the
//   same attribute and inside the deadline
//   the landing's scroll motion: driven by the scroll itself, settled without scroll timelines or with reduced motion
//   docs titles and shared sea links: nothing moves on its own
// The browser half (tests/motion.browser.mjs, tests/demo-player.browser.mjs) proves it on the packaged site.
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

import { OVERTURE_ATTR, OVERTURE_DEADLINE, OVERTURE_KEY } from "../lib/site/overture.mjs"
import { DEMO_SCORES } from "../components/site/demo-scores.ts"

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (name === "node_modules" || name === ".next") return []
    return statSync(full).isDirectory() ? sources(full) : /\.(tsx?|mjs|css)$/.test(name) ? [full.split(path.sep).join("/")] : []
  })
}

const failures = []
const fail = (rule, message) => failures.push(`${rule}: ${message}`)
const read = (file) => readFileSync(file, "utf8")

// ── scripted demos ──
const scripted = Object.entries(DEMO_SCORES).filter(([, score]) => score.script)
if (!scripted.length) fail("scripted demos", "DEMO_SCORES has no scripted entry; the gate would pass on nothing")
for (const [name, score] of scripted) if (!score.phrase?.trim()) fail("scripted demos", `${name} has no phrase to describe what Demonstrate does`)

const player = read("components/site/demo-player.ts")
const starts = [...player.matchAll(/\bstart\(/g)].filter((m) => !/const start = async/.test(player.slice(m.index - 20, m.index + 20)))
if (starts.length !== 1 || !/demonstrate:\s*\(\)\s*=>\s*\{\s*void start\(\)/.test(player))
  fail("scripted demos", `demo-player.ts must call start() in exactly one place, the Demonstrate control (found ${starts.length})`)
const discover = player.slice(player.indexOf("const discover"), player.indexOf("const hands"))
if (!discover.includes("choreography.compose")) fail("scripted demos", "discover() no longer reads the choreography; this check cannot see what it does")
if (/\bstart\(|\bquiet\(|\.click\(|dispatchEvent|\.focus\(/.test(discover)) fail("scripted demos", "discover() must only look: no start, click, focus or event")
for (const file of ["app/docs/[item]/demo-example.tsx"]) {
  const source = read(file)
  if (!/Demonstrate/.test(source) || !/data-demo-control/.test(source)) fail("scripted demos", `${file} has no Demonstrate control`)
}

// ── the home overture ──
if (!(OVERTURE_DEADLINE > 0 && OVERTURE_DEADLINE < 3000)) fail("the home overture", `deadline ${OVERTURE_DEADLINE}ms is not under three seconds`)
const tokens = read("registry/0nlytype/styles/tokens.css")
const ms = (token) => Number(tokens.match(new RegExp(`${token}:\\s*(\\d+)ms`))?.[1])
const landing = read("app/landing.css")
// Every overture rule in landing.css: gated by the attribute, under no-preference, on the tokens, inside the deadline.
const block = landing.match(/@media \(prefers-reduced-motion: no-preference\) \{\n((?:  html\[data-overture-at\][^\n]*\n)+)\}/)
if (!block) fail("the home overture", "landing.css must keep the overture's rules together, each gated by html[data-overture-at], under prefers-reduced-motion: no-preference")
else {
  const rules = block[1].trim().split("\n")
  const parts = { "zero-settle": "the hands' letters", "zero-reach-r": "your hand", "zero-reach-l": "our hand", "zero-light": "the dot" }
  for (const [name, what] of Object.entries(parts)) if (!rules.some((r) => r.includes(`animation: ${name} `))) fail("the home overture", `${what} (${name}) no longer play inside the overture`)
  const token = (expr) => expr.replace(/var\((--ot-[a-z]+)\)/g, (_, t) => String(ms(t))).replace(/var\(--k\)/g, "1").replace(/ - var\(--late, 0ms\)/g, "").replace(/ms/g, "")
  for (const rule of rules) {
    const m = rule.match(/animation: [a-z-]+ var\((--ot-[a-z]+)\) var\(--ot-[a-z]+\) both; animation-delay: calc\((.+)\); \}$/)
    if (!m) { fail("the home overture", `not on the motion tokens, or no late-start offset: ${rule.trim()}`); continue }
    // The longest path: the last letter's delay (--k at 1) plus its duration.
    const took = Function(`return (${token(m[2])}) + ${ms(m[1])}`)()
    if (!(took <= OVERTURE_DEADLINE)) fail("the home overture", `${rule.trim().slice(0, 60)}... ends at ${took}ms, past the ${OVERTURE_DEADLINE}ms deadline`)
  }
}
if (OVERTURE_ATTR !== "data-overture-at") fail("the home overture", "css and lifecycle disagree on the attribute")
if (/^\.zero-hands[^{]*\{[^}]*animation/m.test(landing)) fail("the home overture", "the hands must not animate outside the overture: later visits arrive settled")
const zero = read("components/site/landing-zero.tsx")
if (!/overtureActive\(\)/.test(zero) || !/overtureLeft\(\)/.test(zero)) fail("the home overture", "the zero must read how much of the overture is left, so a late start skips what has passed")
// Storage: one key, written by the script in the page, nowhere else.
const keyUses = ["components", "app", "lib", "registry"].flatMap((dir) => sources(dir)).filter((file) => read(file).includes(OVERTURE_KEY) || read(file).includes("overture-seen"))
if (keyUses.length !== 1 || keyUses[0] !== "lib/site/overture.mjs") fail("the home overture", `the overture key belongs only in lib/site/overture.mjs (found ${keyUses.join(", ") || "nowhere"})`)

// ── the landing's scroll motion: the scroll drives it, and it is settled without it ──
const scrollDriven = [...landing.matchAll(/@supports \(animation-timeline: view\(\)\) \{\n  @media \(prefers-reduced-motion: no-preference\) \{\n([\s\S]*?)\n  \}\n\}/g)].map((m) => m[1])
if (!scrollDriven.some((b) => /\.leaves-strike::after \{[^}]*animation-timeline/.test(b))) fail("the landing's scroll motion", "the strikes in 02 must be drawn by a scroll timeline, under @supports and no-preference")
if (!scrollDriven.some((b) => /\.sec-title[^{]*\{[^}]*animation: sec-rise[^}]*animation-timeline: view\(\)/.test(b))) fail("the landing's scroll motion", "the sections' one reveal must be a view() timeline, under @supports and no-preference")
// Outside those blocks no rule may name a timeline: without scroll timelines, the page as written is the fallback.
let outside = landing
for (let at = outside.indexOf("@supports (animation-timeline: view())"); at >= 0; at = outside.indexOf("@supports (animation-timeline: view())")) {
  let depth = 0, end = outside.indexOf("{", at)
  for (; end < outside.length; end++) {
    if (outside[end] === "{") depth++
    else if (outside[end] === "}" && --depth === 0) break
  }
  outside = outside.slice(0, at) + outside.slice(end + 1)
}
if (/animation-timeline|view-timeline/.test(outside)) fail("the landing's scroll motion", "a scroll timeline sits outside @supports (animation-timeline: view()), where the settled page would not be the fallback")
const sea = read("components/site/landing-sea.tsx")
if (!/setTimeout\(\(\) => draw\.current\(true\), \d+\)/.test(sea)) fail("shared sea links", "typing must re-set the sea only after a pause (a debounced draw)")
if (!/if \(!typed\.current\) \{\n\s*draw\.current\(false\)/.test(sea)) fail("shared sea links", "a line that was not typed (a shared link) must be drawn settled")
const seaShared = sea.slice(sea.indexOf("Opened from a shared link"), sea.indexOf("The drawing:"))
if (!seaShared || /typed\.current = true|draw\.current\(true\)/.test(seaShared)) fail("shared sea links", "a shared link must arrive settled, never as if it were typed")

// ── docs titles ──
const site = read("app/site.css")
if (/\.doc-title[^{]*\{[^}]*animation/.test(site) || /@keyframes site-settle/.test(site)) fail("docs titles", "a docs page title must stay still")

// ── the clock belongs to the inline script; the component only listens ──
const overtureScript = read("lib/site/overture.mjs")
if (!/setTimeout\(\(\)=>end\("deadline"\)/.test(overtureScript)) fail("the home overture", "the inline script must own the deadline timer")
const overtureView = read("components/site/landing-overture.tsx")
if (/setTimeout|setInterval|addEventListener\((?!OVERTURE_END_EVENT)/.test(overtureView)) fail("the home overture", "landing-overture.tsx must only listen for the end; the clock lives in the inline script")

// ── every engine, every time ──
const runner = read("tests/run-motion.mjs")
for (const engine of ["chromium", "firefox", "webkit"]) if (!runner.includes(`"${engine}"`)) fail("browser engines", `tests/run-motion.mjs must run ${engine}`)
if (!/"check:motion":\s*"[^"]*run-motion\.mjs/.test(read("package.json"))) fail("browser engines", "check:motion must go through tests/run-motion.mjs")
const ci = read(".github/workflows/ci.yml")
if (!/playwright install[^\n]*chromium[^\n]*firefox[^\n]*webkit/.test(ci)) fail("browser engines", "CI must install chromium, firefox and webkit")
for (const file of ["tests/motion.browser.mjs", "tests/demo-player.browser.mjs"]) if (/\.skip\(|test\.skip|if \(!installed/.test(read(file))) fail("browser engines", `${file} must not skip an engine`)

if (failures.length) { console.error(failures.map((f) => `- ${f}`).join("\n")); process.exit(1) }
console.log(`Motion contract holds: ${scripted.length} scripted demos wait for Demonstrate, the overture plays once under ${OVERTURE_DEADLINE}ms, the landing's scroll motion settles without the scroll, docs titles and shared sea links are still.`)
