// The home overture's lifecycle, in one place: what is stored, how long it may run, and the script that owns the clock.
//
// Storage: one key, one value ("1"), no personal data. It records that this browser has been shown the overture.
// It is written BEFORE the overture starts, so a reload, a back navigation or a second tab never replays it.
// If storage is unavailable (disabled, private mode, quota), reading or writing throws, and the overture is
// skipped: the page arrives settled. Nothing waits on storage: the script runs once, synchronously, in the
// page's own HTML before the hero paints.
export const OVERTURE_KEY = "0nlytype-overture-seen"
// The key before the rename. It is only read, once, so a returning visitor is not shown the overture again; the new key is the only one written.
export const OVERTURE_KEY_LEGACY = "0db-overture-seen"
// Set on <html> while the overture plays, holding when it began: 0, the navigation's start, so the deadline counts from
// the moment the page was asked for and neither a slow network nor a slow hydration can stretch it. CSS and the skip
// control read the attribute.
export const OVERTURE_ATTR = "data-overture-at"
// Everything, the hands, the gap and the dot, is settled this many ms after the overture began: the hero is whole
// within half a second, a frame to spare (owner 2026-10-26; it was 2000ms).
export const OVERTURE_DEADLINE = 480
// Fired on document when the overture ends, with the reason in event.detail: "deadline", "skip", "input" or "motion".
export const OVERTURE_END_EVENT = "overture-end"

// Release one piece of decorative work per idle turn, rather than flooding the first frame after Skip intro.
const waiting = new Set()
let pumping = false
function pump() {
  if (pumping || !waiting.size) return
  pumping = true
  const run = () => {
    pumping = false
    const next = waiting.values().next().value
    waiting.delete(next)
    try { next?.() } finally { pump() }
  }
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1500 })
  else setTimeout(run, 60)
}

/** Decorative work waits until the inline clock has answered the person, then takes an idle turn. */
export function afterOverture(fn) {
  const turn = () => fn()
  const start = () => {
    document.removeEventListener(OVERTURE_END_EVENT, start)
    waiting.add(turn)
    pump()
  }
  if (document.documentElement.hasAttribute(OVERTURE_ATTR)) document.addEventListener(OVERTURE_END_EVENT, start)
  else start()
  return () => {
    document.removeEventListener(OVERTURE_END_EVENT, start)
    waiting.delete(turn)
  }
}

// The script is the one clock. It decides, marks <html>, and then itself ends the overture at the deadline, or on
// the person's first key, press, touch, wheel or scroll past 4px, a click on Skip intro, or a change to reduced
// motion. Tab and the modifiers do not end it, and neither do Enter or Space on Skip intro itself: that press is a
// click, which ends it, and ending on the key first would move focus to the first action in time for the same press
// to activate it. It uses delegated listeners on document and window, so every one of these works before React has
// loaded, and it still ends on time if React never does. Ending removes the attribute and its own listeners, hands
// focus from Skip intro to the first action, and fires OVERTURE_END_EVENT for anything that waits on the end.
// Written as a string because it runs in the page's HTML; plain ES2017, no imports.
const clock = `
const d=document.documentElement,t=setTimeout(()=>end("deadline"),Math.max(0,${OVERTURE_DEADLINE}-performance.now())),off=[];
const on=(n,f,o,e)=>{(e||document).addEventListener(n,f,o);off.push(()=>(e||document).removeEventListener(n,f,o))};
const onSkip=e=>!!(e.target&&e.target.closest&&e.target.closest(".hero-skip"));
function end(why){
if(!d.hasAttribute(A))return;
clearTimeout(t);off.forEach(f=>f());
const s=document.querySelector(".hero-skip");
if(s&&document.activeElement===s){const a=document.querySelector(".hero-cta a");if(a)a.focus()}
d.setAttribute("data-overture-ended",why);
d.removeAttribute(A);
document.dispatchEvent(new CustomEvent(${JSON.stringify(OVERTURE_END_EVENT)},{detail:why}))}
on("keydown",e=>{
if(e.key==="Tab"&&!e.shiftKey&&(document.activeElement===document.body||document.activeElement===d)){
const s=document.querySelector(".hero-skip");if(s&&s.focus){e.preventDefault();s.focus();return}}
if(["Tab","Shift","Control","Alt","Meta"].indexOf(e.key)<0&&!((e.key==="Enter"||e.key===" ")&&onSkip({target:document.activeElement})))end("input")},true);
on("pointerdown",e=>end(onSkip(e)?"skip":"input"),true);
on("click",e=>{if(onSkip(e))end("skip")},true);
on("touchstart",()=>end("input"),{capture:true,passive:true});
on("wheel",()=>end("input"),{capture:true,passive:true});
on("scroll",()=>{if(scrollY>4)end("input")},{passive:true},window);
on("change",()=>{if(m.matches)end("motion")},0,m);
`

/** Runs in the page before the hero paints. Plays only on a browser's first visit to the top of the home page. */
// The CSS entrance shares the deadline even on repeat visits or when storage refuses the overture.
const heroClock = `const h=document.documentElement,n=performance.now();if(n>=${OVERTURE_DEADLINE}||matchMedia("(prefers-reduced-motion: reduce)").matches)h.setAttribute("data-hero-settled","");else{h.style.setProperty("--hero-late",n+"ms");setTimeout(()=>h.setAttribute("data-hero-settled",""),${OVERTURE_DEADLINE}-n)}`

export const OVERTURE_SCRIPT = `(()=>{try{${heroClock}const A=${JSON.stringify(OVERTURE_ATTR)},K=${JSON.stringify(OVERTURE_KEY)},O=${JSON.stringify(OVERTURE_KEY_LEGACY)};if(localStorage.getItem(K))return;const seen=localStorage.getItem(O);localStorage.setItem(K,"1");if(seen)return;const m=matchMedia("(prefers-reduced-motion: reduce)");if(m.matches||location.hash||scrollY>4||performance.now()>=${OVERTURE_DEADLINE})return;document.documentElement.setAttribute(A,"0");${clock.replace(/\n/g, "")}}catch{}})()`
