import assert from "node:assert/strict"
import test from "node:test"
import vm from "node:vm"

import { OVERTURE_ATTR, OVERTURE_DEADLINE, OVERTURE_END_EVENT, OVERTURE_KEY, OVERTURE_KEY_LEGACY, OVERTURE_SCRIPT } from "../lib/site/overture.mjs"

// The first-visit decision is a script that runs in the page's HTML before the hero paints. These tests run the
// real script text against a fake browser, so the storage design and the clock are held to what they say: one key, written before
// the overture starts, and nothing played if storage, a hash, a scroll offset or reduced motion says not to.

function browser({ store = {}, reduced = false, hash = "", scroll = 0, throwOn = null, focus = null } = {}) {
  const attrs = {}
  const calls = { get: [], set: [] }
  const localStorage = {
    getItem(key) { calls.get.push(key); if (throwOn === "get") throw new Error("denied"); return key in store ? store[key] : null },
    setItem(key, value) { calls.set.push([key, value]); if (throwOn === "set") throw new Error("quota"); store[key] = value },
  }
  const listeners = { document: {}, window: {}, media: {} }
  const target = (name) => ({
    addEventListener: (type, fn) => { (listeners[name][type] ??= new Set()).add(fn) },
    removeEventListener: (type, fn) => { listeners[name][type]?.delete(fn) },
  })
  const timers = []
  const events = []
  const focused = []
  const media = { matches: reduced, ...target("media") }
  const document = {
    ...target("document"),
    documentElement: { setAttribute: (name, value) => { attrs[name] = value }, removeAttribute: (name) => { delete attrs[name] }, hasAttribute: (name) => name in attrs },
    querySelector: (selector) => selector === ".hero-skip" ? { id: "skip" } : { focus: () => focused.push("action") },
    activeElement: focus === "skip" ? { id: "skip" } : null,
    dispatchEvent: (event) => { events.push(event) },
  }
  // The skip control is the one element the script looks up twice; make activeElement compare equal to it.
  if (focus === "skip") { const skip = { id: "skip", closest: (selector) => selector === ".hero-skip" ? skip : null }; document.querySelector = (selector) => selector === ".hero-skip" ? skip : { focus: () => focused.push("action") }; document.activeElement = skip }
  const context = vm.createContext({
    localStorage,
    matchMedia: () => media,
    location: { hash },
    scrollY: scroll,
    performance: { now: () => 412.6 },
    document,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } },
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true },
    ...target("window"),
  })
  context.window = context
  const run = () => vm.runInContext(OVERTURE_SCRIPT, context)
  const fire = (name, type, event = {}) => { for (const fn of [...(listeners[name][type] ?? [])]) fn({ target: { closest: () => null }, ...event }) }
  const live = () => Object.values(listeners).reduce((n, group) => n + Object.values(group).reduce((m, set) => m + set.size, 0), 0)
  return { run, attrs, store, calls, timers, events, focused, fire, live, context }
}

test("the deadline leaves the overture well under three seconds", () => {
  assert.ok(OVERTURE_DEADLINE > 0 && OVERTURE_DEADLINE < 3000)
})

test("a first visit plays, and records itself before it starts", () => {
  const b = browser()
  b.run()
  assert.deepEqual(b.calls.set, [[OVERTURE_KEY, "1"]])
  assert.equal(b.attrs[OVERTURE_ATTR], "413")
})

test("the second visit arrives settled, and writes nothing more", () => {
  const store = {}
  browser({ store }).run()
  const again = browser({ store })
  again.run()
  assert.equal(again.attrs[OVERTURE_ATTR], undefined)
  assert.deepEqual(again.calls.set, [])
})

test("a visitor who saw it under the old key arrives settled, and only the new key is written", () => {
  const b = browser({ store: { [OVERTURE_KEY_LEGACY]: "1" } })
  b.run()
  assert.equal(b.attrs[OVERTURE_ATTR], undefined)
  assert.deepEqual(b.calls.set, [[OVERTURE_KEY, "1"]])
  const again = browser({ store: b.store })
  again.run()
  assert.deepEqual(again.calls.set, [])
})

test("one key, no personal data", () => {
  const b = browser()
  b.run()
  assert.deepEqual(Object.keys(b.store), [OVERTURE_KEY])
  assert.equal(b.store[OVERTURE_KEY], "1")
})

test("storage that refuses to be read skips the overture", () => {
  const b = browser({ throwOn: "get" })
  assert.doesNotThrow(() => b.run())
  assert.equal(b.attrs[OVERTURE_ATTR], undefined)
})

test("storage that refuses to be written skips the overture, so it can never replay unrecorded", () => {
  const b = browser({ throwOn: "set" })
  assert.doesNotThrow(() => b.run())
  assert.equal(b.attrs[OVERTURE_ATTR], undefined)
})

test("a missing localStorage skips the overture", () => {
  const attrs = {}
  const context = vm.createContext({ document: { documentElement: { setAttribute: (name, value) => { attrs[name] = value } } } })
  assert.doesNotThrow(() => vm.runInContext(OVERTURE_SCRIPT, context))
  assert.deepEqual(attrs, {})
})

test("reduced motion counts as seen and never plays", () => {
  const b = browser({ reduced: true })
  b.run()
  assert.equal(b.attrs[OVERTURE_ATTR], undefined)
  assert.equal(b.store[OVERTURE_KEY], "1")
})

test("arriving at a hash, or part-way down, counts as seen and never plays", () => {
  for (const options of [{ hash: "#tune" }, { scroll: 800 }]) {
    const b = browser(options)
    b.run()
    assert.equal(b.attrs[OVERTURE_ATTR], undefined)
    assert.equal(b.store[OVERTURE_KEY], "1")
  }
})

// ── the clock: the script alone ends the overture, with no help from React ──
test("the script sets its own deadline timer, at the deadline", () => {
  const b = browser()
  b.run()
  assert.equal(b.timers.length, 1)
  assert.equal(b.timers[0].ms, OVERTURE_DEADLINE)
  b.timers[0].fn()
  assert.equal(b.attrs[OVERTURE_ATTR], undefined)
  assert.equal(b.events.length, 1)
  assert.equal(b.events[0].type, OVERTURE_END_EVENT)
  assert.equal(b.events[0].detail, "deadline")
  assert.equal(b.attrs["data-overture-ended"], "deadline", "late hydration must know this load already ended its entrance")
  assert.equal(b.live(), 0, "ending must remove every listener it added")
})

test("a key, a press, a touch, the wheel and a scroll past 4px each end it; Tab and modifiers do not", () => {
  for (const [name, type, event, why] of [["document", "keydown", { key: "Escape" }, "input"], ["document", "pointerdown", {}, "input"], ["document", "touchstart", {}, "input"], ["document", "wheel", {}, "input"]]) {
    const b = browser()
    b.run()
    b.fire(name, type, event)
    assert.equal(b.attrs[OVERTURE_ATTR], undefined, `${type} did not end it`)
    assert.equal(b.events[0].detail, why)
  }
  const b = browser()
  b.run()
  for (const key of ["Tab", "Shift", "Control", "Alt", "Meta"]) b.fire("document", "keydown", { key })
  assert.notEqual(b.attrs[OVERTURE_ATTR], undefined, "Tab or a modifier ended it")
  b.context.scrollY = 3
  b.fire("window", "scroll")
  assert.notEqual(b.attrs[OVERTURE_ATTR], undefined, "a 3px scroll ended it")
  b.context.scrollY = 5
  b.fire("window", "scroll")
  assert.equal(b.attrs[OVERTURE_ATTR], undefined, "a scroll past 4px did not end it")
})

test("a click on Skip intro ends it as 'skip', and a press on it too", () => {
  const onSkip = { target: { closest: (selector) => selector === ".hero-skip" ? {} : null } }
  const click = browser()
  click.run()
  click.fire("document", "click", onSkip)
  assert.equal(click.events[0].detail, "skip")
  const press = browser()
  press.run()
  press.fire("document", "pointerdown", onSkip)
  assert.equal(press.events[0].detail, "skip")
})

test("asking for reduced motion mid-way ends it", () => {
  const b = browser()
  b.run()
  b.fire("media", "change")
  assert.notEqual(b.attrs[OVERTURE_ATTR], undefined, "a change that is not 'reduce' must not end it")
  b.context.matchMedia().matches = true
  b.fire("media", "change")
  assert.equal(b.attrs[OVERTURE_ATTR], undefined)
  assert.equal(b.events[0].detail, "motion")
})

test("ending moves focus from Skip intro to the first action, and only then", () => {
  const withFocus = browser({ focus: "skip" })
  withFocus.run()
  withFocus.fire("document", "click", { target: { closest: (selector) => selector === ".hero-skip" ? {} : null } })
  assert.deepEqual(withFocus.focused, ["action"])
  const without = browser()
  without.run()
  without.fire("document", "keydown", { key: "Enter" })
  assert.deepEqual(without.focused, [])
})

test("Enter or Space on Skip intro waits for its click, so the press cannot go on to the next action", () => {
  for (const key of ["Enter", " "]) {
    const b = browser({ focus: "skip" })
    b.run()
    b.fire("document", "keydown", { key, target: { closest: (selector) => selector === ".hero-skip" ? {} : null } })
    assert.notEqual(b.attrs[OVERTURE_ATTR], undefined, `${JSON.stringify(key)} on Skip intro ended it before its click`)
    assert.deepEqual(b.focused, [], "focus moved on the key, so the same press would activate the next action")
    b.fire("document", "click", { target: { closest: (selector) => selector === ".hero-skip" ? {} : null } })
    assert.equal(b.attrs[OVERTURE_ATTR], undefined)
    assert.equal(b.events[0].detail, "skip")
  }
  const other = browser({ focus: "skip" })
  other.run()
  other.fire("document", "keydown", { key: "a" })
  assert.equal(other.attrs[OVERTURE_ATTR], undefined, "another key on Skip intro should still end it")
})

test("the first forward Tab reaches Skip intro directly, then leaves Tab to the browser", () => {
  const b = browser(), doc = b.context.document
  doc.body = {}
  doc.activeElement = doc.body
  const skip = { focus: () => { doc.activeElement = skip } }
  doc.querySelector = () => skip
  b.run()
  assert.equal(doc.activeElement, doc.body, "the intro must not move focus without a key")
  let prevented = 0
  const tab = { key: "Tab", preventDefault: () => { prevented++ } }
  b.fire("document", "keydown", { ...tab, shiftKey: true })
  assert.equal(prevented, 0, "Shift+Tab keeps its native direction")
  b.fire("document", "keydown", tab)
  assert.equal(doc.activeElement, skip)
  assert.equal(prevented, 1)
  assert.notEqual(b.attrs[OVERTURE_ATTR], undefined, "Tab must not end the intro")
  b.fire("document", "keydown", tab)
  assert.equal(prevented, 1, "Tab from the control must not be trapped")
})

test("ending twice is harmless: one event, and the timer is cleared", () => {
  const b = browser()
  b.run()
  b.fire("document", "keydown", { key: "a" })
  b.timers[0].fn()
  assert.equal(b.events.length, 1)
  assert.equal(b.timers[0].cleared, true)
})

test("a refused or settled visit starts no clock at all", () => {
  for (const options of [{ throwOn: "get" }, { throwOn: "set" }, { reduced: true }, { hash: "#x" }, { scroll: 99 }]) {
    const b = browser(options)
    b.run()
    assert.equal(b.timers.length, 0)
    assert.equal(b.live(), 0)
  }
})
