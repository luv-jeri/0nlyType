"use client"

import * as React from "react"

import { cn } from "@/registry/0nlytype/lib/utils"
import { roll } from "@/registry/0nlytype/lib/roll"
import { rove } from "@/registry/0nlytype/lib/rove"
import { Ring } from "@/registry/0nlytype/ui/radial-chart"

type PieChartProps = Omit<React.ComponentProps<"figure">, "children"> & {
  /** One arc per entry, clockwise from the top in this order. */
  data: { label: string; value: number }[]
  /** Names the chart for assistive tech, e.g. "Where visits came from, September". */
  label: string
  /** What the values count. At rest the number reads "visits in all". */
  unit?: string
  format?: (value: number) => string
  /** ring: a whole ring, the total inside. horizon: a half ring standing on a horizon, the total on the line. */
  variant?: "ring" | "horizon"
  /** Pins the pointed-at look on one arc; set on the root for documentation. */
  "data-force"?: string
}

const figures = new Intl.NumberFormat("en-GB")
// The paper left between two arcs, as a share of the ring. ponytail: a fixed share, about 9px on a 22rem ring.
const GAP = 0.01
const place = (i: number) => String(i + 1).padStart(2, "0")

/**
 * Shares of a whole: one ring cut into arcs with a hairline of paper between them, numbered round the rim, and the
 * total as one very large number inside. Point at an arc, or focus its name, and it inks in the accent, the others
 * step back, and the total rolls down to that arc's share; leave and it rolls back up to the total.
 */
function PieChart({ data, label, unit, format = figures.format, variant = "ring", className, style, ...props }: PieChartProps) {
  const force = props["data-force"]?.split(" ").includes("hover")
  const [shown, setShown] = React.useState(force ? 0 : -1)
  const target = React.useRef(shown)
  const value = React.useRef<HTMLSpanElement>(null)
  const face = React.useRef<HTMLDivElement>(null)
  const key = React.useRef<HTMLUListElement>(null)

  const values = data.map((d) => (Number.isFinite(d.value) && d.value > 0 ? d.value : 0))
  const total = values.reduce((a, b) => a + b, 0)
  const shares = values.map((v) => (total > 0 ? v / total : 0))
  const starts = shares.map((_, i) => shares.slice(0, i).reduce((a, b) => a + b, 0))
  const many = shares.filter(Boolean).length > 1

  function show(i: number) {
    if (i === target.current || !value.current) return
    const was = target.current < 0 ? 1 : shares[target.current]
    const next = i < 0 ? 1 : shares[i]
    target.current = i
    roll(value.current, () => setShown(i), "0.3em", next > was ? 1 : -1)
  }
  const rest = () => !key.current?.contains(document.activeElement) && show(-1)

  // The arc under the pointer, read by its angle; off the ring (the middle included) the number rolls back to the total.
  function pick(e: React.PointerEvent) {
    const ring = face.current?.querySelector<HTMLElement>(".ot-ring")
    if (!ring || total <= 0) return
    const box = ring.getBoundingClientRect()
    const r = box.width / 2
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl"
    const dx = (e.clientX - box.left - r) * (rtl ? -1 : 1)
    const dy = e.clientY - box.top - r
    if (Math.abs(Math.hypot(dx, dy) - r) > 28) return rest()
    let t = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1
    if (variant === "horizon") {
      t = ((t + 0.25) % 1) / 0.5
      if (t > 1) return rest()
    }
    const i = starts.findIndex((s, k) => shares[k] > 0 && t >= s && t < s + shares[k])
    if (i >= 0) show(i)
  }

  const at = shown >= 0 ? data[shown] : undefined
  const share = shown >= 0 ? shares[shown] * 100 : 0
  const percent = share > 0 && share < 1 ? "<1" : share.toFixed(share < 10 && share % 1 ? 1 : 0)
  const all = `${format(total)}${unit ? ` ${unit}` : ""}`

  return (
    <figure
      data-slot="pie-chart"
      data-variant={variant}
      data-pointed={shown >= 0 || undefined}
      aria-label={label}
      className={cn("ot-pie", className)}
      style={{ "--n": data.length, ...style } as React.CSSProperties}
      {...props}
    >
      <div ref={face} data-slot="pie-chart-face" className="ot-pie-face" aria-hidden="true" onPointerMove={pick} onPointerLeave={rest}>
        <div className="ot-pie-arcs">
          {total > 0 ? (
            data.map((d, i) => {
              if (!shares[i]) return null
              // Each arc gives up the gap at both ends, but never more than half of itself.
              const len = many ? Math.max(shares[i] - GAP, shares[i] / 2) : 1
              return <Ring key={d.label} value={len} from={starts[i] + (shares[i] - len) / 2} head="none" data-shown={i === shown || undefined} />
            })
          ) : (
            <Ring value={0} head="none" data-empty="" />
          )}
        </div>
        {many
          ? data.map((d, i) =>
              shares[i] ? (
                <span key={d.label} className="ot-pie-tick" data-shown={i === shown || undefined} style={{ "--t": starts[i] + shares[i] / 2 } as React.CSSProperties}>
                  {place(i)}
                </span>
              ) : null,
            )
          : null}
      </div>
      <figcaption data-slot="pie-chart-read" className="ot-pie-read">
        <span ref={value} className="ot-pie-value">
          {at ? (
            <>
              {percent}
              <span className="ot-pie-unit">%</span>
            </>
          ) : (
            format(total)
          )}
        </span>
        <span className="ot-pie-words">
          <span className="ot-pie-name">{at ? at.label : unit ? `${unit} in all` : "In all"}</span>
          {/* At rest the line is held open, so the number doesn't move when an arc is pointed at. */}
          <span className="ot-pie-of">{at ? `${format(values[shown])} of ${all}` : "\u00a0"}</span>
        </span>
      </figcaption>
      <ul
        ref={key}
        role="group"
        aria-label={label}
        data-slot="pie-chart-key"
        className="ot-pie-key"
        onKeyDown={(e) => rove(e, "button", true)}
        onPointerLeave={rest}
        onBlur={(e) => !key.current?.contains(e.relatedTarget) && show(-1)}
      >
        {data.map((d, i) => (
          <li key={d.label} role="none">
            <button
              type="button"
              tabIndex={i === Math.max(shown, 0) ? 0 : -1}
              data-shown={i === shown || undefined}
              onPointerEnter={() => show(i)}
              onFocus={() => show(i)}
            >
              <span className="ot-pie-place" aria-hidden="true">{place(i)}</span>
              <span className="ot-pie-key-name">{d.label}</span>
              <span className="ot-pie-key-value">{format(values[i])}</span>
              <span className="ot-sr">{`, ${Math.round(shares[i] * 100)}% of ${all}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  )
}

export { PieChart, type PieChartProps }
