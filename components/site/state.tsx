import * as React from "react"

/** One cell of a states row in the docs: a small label over the item, pinned in that state. */
export function State({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="state">
      <span className="state-label">{label}</span>
      {children}
    </div>
  )
}

/**
 * True where an example is shown as a picture rather than used: the landing's preview, which takes no focus and no
 * press. There an example plays nothing by itself, since its pause could not be reached, and claims no keys of the page.
 */
export const Still = React.createContext(false)
