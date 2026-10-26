import { registryBaseURL } from "../lib/site/config.mjs"
// Holds DESIGN.md, the items and the tokens to each other.
//   every item has ui, content, example and a DESIGN.md contract
//   every --ot- token used is defined
//   no f- names remain
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import path from "node:path"
import { readItems, SOURCE } from "./lib/items.mjs"
import { buildAiKit, checkAiKit, validateAiKit } from "./lib/ai-kit.mjs"

const failures = []
const fail = (check, msg) => failures.push(`${check}: ${msg}`)

// every item has ui, content, example and a DESIGN.md contract
const design = readFileSync("DESIGN.md", "utf8")
const contracts = new Map() // "ot-btn" -> Set of item names in its heading
for (const [, classes, names] of design.matchAll(/^### ((?:ot-[a-z-]+, )*ot-[a-z-]+) \(([^)]+)\)/gm))
  for (const cls of classes.split(", "))
    for (const n of names.split(",")) (contracts.get(cls) ?? contracts.set(cls, new Set()).get(cls)).add(n.trim())
const items = await readItems()
for (const item of items) {
  if (!existsSync(`examples/${item.name}.tsx`)) fail("every item has ui, content, example and a DESIGN.md contract", `${item.name}: no examples/${item.name}.tsx`)
  if (!contracts.get(item.contract)?.has(item.name))
    fail("every item has ui, content, example and a DESIGN.md contract", `${item.name}: DESIGN.md has no "### ${item.contract} (${item.name})" heading`)
}
const named = new Set(items.flatMap((i) => [i.name, ...(i.parts ?? [])]))
for (const f of readdirSync(`${SOURCE}/ui`)) if (!named.has(path.basename(f, ".tsx")))
  fail("every item has ui, content, example and a DESIGN.md contract", `${SOURCE}/ui/${f} has no content/${path.basename(f, ".tsx")}.ts`)

// every --ot- token used is defined: in tokens.css, or declared as a knob in some sidecar,
// or read with a fallback (var(--ot-x, …)), which makes it an optional knob.
const styles = readdirSync(`${SOURCE}/styles`).filter((f) => f.endsWith(".css")).map((f) => `${SOURCE}/styles/${f}`)
const sources = [...styles, ...readdirSync(`${SOURCE}/ui`).map((f) => `${SOURCE}/ui/${f}`), "app/globals.css", "app/site.css"].filter(existsSync)
const defined = new Set()
for (const f of styles) for (const [, t] of readFileSync(f, "utf8").matchAll(/(--ot-[a-z0-9-]+)\s*:/g)) defined.add(t)
for (const f of sources) {
  const text = readFileSync(f, "utf8")
  for (const m of text.matchAll(/var\(\s*(--ot-[a-z0-9-]+)\s*([,)])/g))
    if (m[2] === ")" && !defined.has(m[1])) fail("every --ot- token used is defined", `${f}: ${m[1]}`)
}

// no f- names remain
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css|md|mjs)$/.test(f) ? [p] : []
})
const scanned = ["registry", "app", "components", "examples", "content"].filter(existsSync).flatMap(walk).concat("DESIGN.md", "INTENT.md")
for (const f of scanned) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (/--f-[a-z]|(?<![A-Za-z0-9_@/.-])f-(?=[a-z]+[a-z-]*\b)/.test(line.replace(/https?:\S+/g, "")))
      fail("no f- names remain", `${f}:${i + 1}  ${line.trim().slice(0, 80)}`)
  })
}

// Registry consumers receive the full project licence alongside the font notices.
try {
  const payload = JSON.parse(readFileSync("public/r/0nlytype.json", "utf8"))
  const licence = payload.files?.find((f) => f.target === "styles/0nlytype/LICENCE-0nlytype.md")
  if (!licence || licence.type !== "registry:file" || licence.path !== "LICENCE" || licence.content !== readFileSync("LICENCE", "utf8"))
    fail("base licence", "public/r/0nlytype.json must ship LICENCE to styles/0nlytype/LICENCE-0nlytype.md")
} catch (error) {
  fail("base licence", error.message)
}

// The AI adapters, downloadable references and registry payload share the real sources.
try {
  const kit = buildAiKit({ items, baseURL: registryBaseURL() })
  for (const message of [...checkAiKit(kit), ...validateAiKit(kit)]) fail("AI kit", message)
  const payload = JSON.parse(readFileSync("public/r/ai.json", "utf8"))
  if (payload.name !== "ai" || payload.type !== "registry:item") fail("AI kit", "invalid registry item")
  if (payload.files?.length !== kit.item.files.length) fail("AI kit", "registry file coverage differs")
  for (const expected of kit.item.files) {
    const file = payload.files?.find((f) => f.target === expected.target)
    if (!file || file.type !== "registry:file" || file.path !== expected.path || file.content !== kit.files.get(expected.path))
      fail("AI kit", `registry file differs: ${expected.target}`)
  }
  // Hold the consumer-facing file list and download URLs to the generated kit.
  const page = readFileSync("app/docs/build-with-ai/page.tsx", "utf8")
  const targets = new Set(kit.item.files.map((file) => file.target.slice(2)))
  for (const [, paths] of page.matchAll(/paths: \[([^\]]+)\]/g)) {
    for (const [, target] of paths.matchAll(/"([^"]+)"/g)) {
      const expanded = target.includes("<item>") ? items.map((item) => target.replace("<item>", item.name)) : [target]
      for (const file of expanded) if (!targets.has(file)) fail("AI kit", `documented install target missing: ${file}`)
    }
  }
  for (const [, href] of page.matchAll(/href: "(\/(?:ai\/[^"]+|llms[^"]+))"/g))
    if (!kit.files.has(`public${href}`)) fail("AI kit", `documented download missing: ${href}`)
  for (const file of ["docs/AGENTS.md", "cursor.mdc", "copilot.instructions.md", "claude/SKILL.md", "agents/SKILL.md"])
    if (!kit.files.has(`public/ai/${file}`)) fail("AI kit", `source download missing: /ai/${file}`)
} catch (error) {
  fail("AI kit", error.message)
}

if (failures.length) {
  console.error(failures.join("\n"))
  process.exit(1)
}
console.log(`Drift check holds: ${items.length} items, ${defined.size} tokens.`)
