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
// Set on <html> while the overture plays, holding performance.now() when it began. CSS and the skip control
// read the attribute; the deadline is measured from that moment, so a slow hydration cannot stretch it.
export const OVERTURE_ATTR = "data-overture-at"
// Everything, the hands, the gap and the dot, is settled this many ms after the overture began. Under three seconds.
export const OVERTURE_DEADLINE = 2000
// Fired on document when the overture ends, with the reason in event.detail: "deadline", "skip", "input" or "motion".
export const OVERTURE_END_EVENT = "overture-end"

// The script is the one clock. It decides, marks <html>, and then itself ends the overture at the deadline, or on
// the person's first key, press, touch, wheel or scroll past 4px, a click on Skip intro, or a change to reduced
// motion. Tab and the modifiers do not end it, and neither do Enter or Space on Skip intro itself: that press is a
// click, which ends it, and ending on the key first would move focus to the first action in time for the same press
// to activate it. It uses delegated listeners on document and window, so every one of these works before React has
// loaded, and it still ends on time if React never does. Ending removes the attribute and its own listeners, hands
// focus from Skip intro to the first action, and fires OVERTURE_END_EVENT for anything that waits on the end.
// Written as a string because it runs in the page's HTML; plain ES2017, no imports.
const clock = `
const d=document.documentElement,t=setTimeout(()=>end("deadline"),${OVERTURE_DEADLINE}),off=[];
const on=(n,f,o,e)=>{(e||document).addEventListener(n,f,o);off.push(()=>(e||document).removeEventListener(n,f,o))};
const onSkip=e=>!!(e.target&&e.target.closest&&e.target.closest(".hero-skip"));
function end(why){
if(!d.hasAttribute(A))return;
clearTimeout(t);off.forEach(f=>f());
const s=document.querySelector(".hero-skip");
if(s&&document.activeElement===s){const a=document.querySelector(".hero-cta a");if(a)a.focus()}
d.removeAttribute(A);
document.dispatchEvent(new CustomEvent(${JSON.stringify(OVERTURE_END_EVENT)},{detail:why}))}
on("keydown",e=>{if(["Tab","Shift","Control","Alt","Meta"].indexOf(e.key)<0&&!((e.key==="Enter"||e.key===" ")&&onSkip({target:document.activeElement})))end("input")},true);
on("pointerdown",e=>end(onSkip(e)?"skip":"input"),true);
on("click",e=>{if(onSkip(e))end("skip")},true);
on("touchstart",()=>end("input"),{capture:true,passive:true});
on("wheel",()=>end("input"),{capture:true,passive:true});
on("scroll",()=>{if(scrollY>4)end("input")},{passive:true},window);
on("change",()=>{if(m.matches)end("motion")},0,m);
`

/** Runs in the page before the hero paints. Plays only on a browser's first visit to the top of the home page. */
export const OVERTURE_SCRIPT = `(()=>{try{const A=${JSON.stringify(OVERTURE_ATTR)},K=${JSON.stringify(OVERTURE_KEY)},O=${JSON.stringify(OVERTURE_KEY_LEGACY)};if(localStorage.getItem(K))return;const seen=localStorage.getItem(O);localStorage.setItem(K,"1");if(seen)return;const m=matchMedia("(prefers-reduced-motion: reduce)");if(m.matches||location.hash||scrollY>4)return;document.documentElement.setAttribute(A,String(Math.round(performance.now())));${clock.replace(/\n/g, "")}}catch{}})()`
