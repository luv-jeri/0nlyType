// The name, set: "0nly" in the voice, heavy and condensed, its zero dotted so it never reads as Only; then "Type" in
// the expression's italic, because type is the part you bring. Plain type, no drawing: the dot is the one shape the
// rules allow. The families are fixed (Archivo and Bodoni Moda), whatever pair the page is set in: it is a name.
// Beside words the dot is ink. Only the mark standing alone (app/icon.svg) carries the accent.

/** The dotted zero on its own: the mark. */
export function Mark({ className }: { className?: string }) {
  return (
    <span className={className ? `wm-mark ${className}` : "wm-mark"} aria-hidden="true">
      <span className="wm-zero">0</span>
    </span>
  )
}

/** The compact lockup for the bar: the mark, then the name on one line. */
export function WordmarkCompact() {
  return (
    <>
      <Mark />
      <span className="wm-word" aria-hidden="true">
        <span className="wm-nly">
          <span className="wm-zero">0</span>nly
        </span>
        <span className="wm-type">Type</span>
      </span>
    </>
  )
}

/** The large lockup, as A's: "0nly", then "Type" on its baseline, the T's crossbar reaching back over the y. */
export function Wordmark({ id, className }: { id?: string; className?: string }) {
  return (
    <h1 className={className ? `wm-set ${className}` : "wm-set"} id={id}>
      <span className="ot-sr">0nlyType</span>
      <span className="wm-nly" aria-hidden="true">
        <span className="wm-zero">0</span>nly
      </span>
      <span className="wm-type" aria-hidden="true">
        Type
      </span>
    </h1>
  )
}
