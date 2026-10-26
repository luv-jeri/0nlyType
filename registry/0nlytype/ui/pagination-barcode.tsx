"use client"

import * as React from "react"

/** Reveals the current barcode page inside its own horizontal scroller. */
export function PaginationBarcode({ ref, children, ...props }: React.ComponentProps<"ul">) {
  const list = React.useRef<HTMLUListElement>(null)
  React.useImperativeHandle(ref, () => list.current!, [])

  React.useEffect(() => {
    const nav = list.current?.closest("nav")
    if (!nav) return
    const reveal = () => {
      const current = list.current?.querySelector<HTMLElement>('[aria-current="page"]')
      if (!current) return
      const target = current.getBoundingClientRect()
      const left = nav.getBoundingClientRect().left + nav.clientLeft
      const right = left + nav.clientWidth
      // Move only this scroller horizontally, never the page or its ancestors.
      const delta = target.left < left ? target.left - left : target.right > right ? target.right - right : 0
      if (delta) nav.scrollBy({ left: delta, behavior: "instant" })
    }
    reveal()
    const resize = new ResizeObserver(reveal)
    resize.observe(nav)
    return () => resize.disconnect()
  }, [children])

  return <ul ref={list} {...props}>{children}</ul>
}
