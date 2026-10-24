// Runs the motion browser checks in every engine: Chromium, Firefox and WebKit. An engine that is not installed, or
// that fails to launch, fails here; this runner has no way to skip one.
//   tests/motion.browser.mjs        the overture lifecycle, shared toy links and docs titles: every engine, day and nocturne
//   tests/demo-player.browser.mjs   the scripted demos: all of them in Chromium, one of every script kind in the others
// The landing checks measure a 2s wall-clock deadline: engines take turns so another browser's canvas or demo
// cannot consume that window on a shared CI runner. Once every landing check finishes, demo suites run side by side.
import { spawn } from "node:child_process"

const ENGINES = ["chromium", "firefox", "webkit"]
const plan = (engine) => [
  ...["light", "dark"].map((scheme) => ({ file: "tests/motion.browser.mjs", engine, scheme })),
]

const run = (job) => new Promise((resolve) => {
  const label = `${job.file.replace("tests/", "").replace(".browser.mjs", "")} / ${job.engine}${job.scheme ? ` / ${job.scheme === "dark" ? "nocturne" : "day"}` : ""}`
  const started = Date.now()
  let output = ""
  const child = spawn(process.execPath, ["--import", "tsx", job.file], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MOTION_ENGINE: job.engine, ...(job.scheme ? { MOTION_SCHEME: job.scheme } : {}) } })
  child.stdout.on("data", (chunk) => { output += chunk })
  child.stderr.on("data", (chunk) => { output += chunk })
  const done = (code) => {
    const seconds = Math.round((Date.now() - started) / 1000)
    console.log(`${code === 0 ? "PASS" : "FAIL"}  ${label}  (${seconds}s)\n${output.trim().split("\n").map((line) => `      ${line}`).join("\n")}`)
    resolve({ label, seconds, ok: code === 0 })
  }
  child.on("exit", (status) => done(status ?? 1))
  child.on("error", (error) => { output += String(error); done(1) })
})

const results = []
for (const engine of ENGINES) {
  for (const job of plan(engine)) results.push(await run(job))
}
results.push(...await Promise.all(ENGINES.map((engine) => run({ file: "tests/demo-player.browser.mjs", engine }))))

const failed = results.filter((r) => !r.ok)
if (failed.length) { console.error(`\nMotion checks failed in:\n${failed.map((r) => `- ${r.label}`).join("\n")}`); process.exit(1) }
console.log(`\nMotion checks passed: ${results.length} runs across ${ENGINES.join(", ")}.`)
