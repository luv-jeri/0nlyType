"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/registry/0nlytype/lib/utils"

/** Numbers with a dot beneath each; the current page's dot is the accent. Pair it with paginationRange for long runs. */
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav data-slot="pagination" aria-label="Pages" className={className} {...props} />
}

type PaginationContentProps = React.ComponentProps<"ul"> & {
  /**
   * numbers: every page shown, a dot under each. folio: the current page over the total, arrows only. neighbours: the pages either side, by name.
   * barcode: every page a hairline, only yours numbered. thumb: an alphabet set as one word, the current letter reversed out.
   */
  variant?: "numbers" | "folio" | "neighbours" | "barcode" | "thumb"
}

function PaginationContent({ className, variant = "numbers", ref, children, ...props }: PaginationContentProps) {
  const list = React.useRef<HTMLUListElement>(null)
  React.useImperativeHandle(ref, () => list.current!, [])

  React.useEffect(() => {
    if (variant !== "barcode") return
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
  }, [variant, children])

  return <ul ref={list} data-slot="pagination-content" data-variant={variant} className={cn("ot-pager", className)} {...props}>{children}</ul>
}

/**
 * The pages to show for a long run: the ends, the current page and `siblings` either side, "gap" for the runs left out.
 * Always the same number of slots (siblings * 2 + 5, or fewer pages), so nothing beside the pager moves as you page,
 * and a gap never stands for a single page.
 */
function paginationRange(current: number, total: number, siblings = 1): (number | "gap")[] {
  const slots = siblings * 2 + 5
  const run = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
  if (total <= slots) return run(1, total)
  if (current <= siblings + 3) return [...run(1, slots - 2), "gap", total]
  if (current >= total - siblings - 2) return [1, "gap", ...run(total - slots + 3, total)]
  return [1, "gap", ...run(current - siblings, current + siblings), "gap", total]
}

function PaginationItem(props: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = React.ComponentProps<"a"> & {
  isActive?: boolean
  /** Render your own link (Next's Link, say) with the pager's look. */
  asChild?: boolean
}

/** A page number. Give it an aria-label that holds the number as shown ("Page 03" for 03), so a voice command for what is seen still finds it; the number alone is a poor name. */
function PaginationLink({ isActive = false, asChild = false, ...props }: PaginationLinkProps) {
  const Comp = asChild ? Slot : "a"
  return <Comp data-slot="pagination-link" aria-current={isActive ? "page" : undefined} {...props} />
}

type StepProps = Omit<PaginationLinkProps, "isActive" | "href"> & {
  /** Omit at the first or last page: the step shows, but doesn't go anywhere. */
  href?: string
}

function step(kind: "previous" | "next", dflt: string) {
  return function Step({ href, asChild = false, className, children = dflt, ...props }: StepProps) {
    const Comp = asChild ? Slot : href === undefined ? "span" : "a"
    // A word label (the neighbour's name) needs its direction spoken too.
    const label = typeof children === "string" && children !== dflt ? `${kind === "previous" ? "Previous" : "Next"}: ${children}` : undefined
    return (
      <Comp
        data-slot={`pagination-${kind}`}
        className={cn("ot-pager-step", className)}
        rel={href === undefined ? undefined : kind === "previous" ? "prev" : "next"}
        aria-label={label}
        aria-disabled={href === undefined && !asChild ? true : undefined}
        {...(href === undefined ? {} : { href })}
        {...props}
      >
        {children}
      </Comp>
    )
  }
}

/** ← Previous, or ← and a word: the neighbour's name reads well here. The arrow is drawn, so pass only the words. */
const PaginationPrevious = step("previous", "Previous")
/** Next →, or a word and →. */
const PaginationNext = step("next", "Next")

/** Pages left out. */
function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="pagination-ellipsis" className={cn("ot-pager-gap", className)} {...props}>
      <span aria-hidden="true">…</span>
      <span className="ot-sr">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  paginationRange,
  type PaginationContentProps,
  type PaginationLinkProps,
}
