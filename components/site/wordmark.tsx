import { useId } from "react"
import { SET } from "@/components/site/wordmark-set"

// The name, set against itself: "0nly" heavy and condensed, a dot in its zero's counter so it never reads as Only,
// sized to the measure of "Type." below it; "Type." in the expression's italic crossing the foot of "0nly", cut out of
// it by a rim of paper, and written: the italic's thick strokes are lines of the library's creed, broken by pretext to
// the width of each stroke. scripts/set-wordmark.mjs sets it once, in a browser, and this only draws what it set: the
// large letters as outlines, the creed as text. The cuts are masks, so the paper is whatever is behind the name.
// The full stop is ink beside other words; --wm-stop gives it the accent where the name stands alone. Everything inside
// a mask is painted black or white by name: masks inherit fill, and the ink is white at night. Its box is its ink, and
// 1em is H, so the font size sets it.

/** The lockup itself. `written` false draws "Type" solid, for sizes where the creed would only be grain. */
export function Lockup({ written = true, className }: { written?: boolean; className?: string }) {
  const id = `wm${useId().replace(/[^\w-]/g, "")}`
  const cut = `${id}cut`, bands = `${id}bands`
  const { w, h, box, nly, type, fs, lh, lines, paths } = SET
  return (
    <svg className={className ? `wm-lockup ${className}` : "wm-lockup"} viewBox={box.join(" ")} width={`${box[2] / 100}em`} height={`${box[3] / 100}em`} fill="currentColor" aria-hidden="true" focusable="false">
      <defs>
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
          <rect width={w} height={h} fill="#fff" />
          <path d={paths.type + paths.stop} fill="#000" stroke="#000" strokeWidth={type.rim} strokeLinejoin="round" />
        </mask>
        {written && (
          <mask id={bands} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
            <rect width={w} height={h} fill="#fff" />
            {lines.map(([x, y, bw], i) => <rect key={i} x={x} y={y} width={bw} height={lh} fill="#000" />)}
          </mask>
        )}
      </defs>
      <g className="wm-nly" mask={`url(#${cut})`}>
        <path d={paths.nly} />
        <circle cx={nly.dot[0]} cy={nly.dot[1]} r={nly.dot[2]} />
      </g>
      <g className="wm-type">
        <path d={paths.type} mask={written ? `url(#${bands})` : undefined} />
        {written && (
          <g className="wm-creed" fontSize={fs}>
            {lines.map(([x, y, , text, fit], i) => (
              <text key={i} x={x} y={y + lh * 0.78} textLength={fit} lengthAdjust="spacing">{text}</text>
            ))}
          </g>
        )}
      </g>
      <path className="wm-stop" d={paths.stop} />
    </svg>
  )
}

/** The page's title: the lockup, named for everyone who cannot see it. */
export function Wordmark({ id, className }: { id?: string; className?: string }) {
  return (
    <h1 className={className ? `wm-set ${className}` : "wm-set"} id={id}>
      <span className="ot-sr">0nlyType</span>
      <Lockup />
    </h1>
  )
}
