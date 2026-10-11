"use client"

import * as React from "react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  paginationRange,
} from "@/registry/0nlytype/ui/pagination"
import { State } from "@/components/site/state"

const pad = (n: number) => String(n).padStart(2, "0")
const chapters = ["Halden", "Marram", "Tarn", "Scree", "Corrie"]

type Go = (n: number) => { href: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> }
type Pager = { page: number; go: Go; total: number }

/** The page, and the props that make a link turn to page n. Links stay links: a real href, and a plain click turns the page here. */
function usePage(first: number, href = (n: number) => `?page=${n}`): [number, Go] {
  const [page, setPage] = React.useState(first)
  const go = (n: number) => ({
    href: href(n),
    onClick(e: React.MouseEvent<HTMLAnchorElement>) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return // a new tab or window: let the link be a link
      e.preventDefault()
      setPage(n)
      // A step that runs out of pages stops being a link, which drops focus. Keep it in the pager, on the new page.
      const nav = e.currentTarget.closest("nav")
      requestAnimationFrame(() => {
        if (nav && !nav.contains(document.activeElement)) (nav.querySelector<HTMLElement>('[aria-current="page"]') ?? nav.querySelector<HTMLElement>("a[href]"))?.focus()
      })
    },
  })
  return [page, go]
}

function Numbers({ page, go, total }: Pager) {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem><PaginationPrevious {...(page > 1 ? go(page - 1) : {})} /></PaginationItem>
        {paginationRange(page, total).map((n, i) => (
          <PaginationItem key={n === "gap" ? `gap-${i}` : n}>
            {n === "gap" ? <PaginationEllipsis /> : <PaginationLink {...go(n)} aria-label={`Page ${n}`} isActive={n === page}>{pad(n)}</PaginationLink>}
          </PaginationItem>
        ))}
        <PaginationItem><PaginationNext {...(page < total ? go(page + 1) : {})} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function Folio({ page, go, total }: Pager) {
  return (
    <Pagination aria-label="Pages, as a folio">
      <PaginationContent variant="folio">
        <PaginationItem><PaginationPrevious {...(page > 1 ? go(page - 1) : {})} /></PaginationItem>
        <PaginationItem><PaginationLink {...go(page)} aria-label={`Page ${page} of ${total}`} isActive>{pad(page)}</PaginationLink></PaginationItem>
        <PaginationItem aria-hidden="true">{pad(total)}</PaginationItem>
        <PaginationItem><PaginationNext {...(page < total ? go(page + 1) : {})} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function Barcode({ page, go, total }: Pager) {
  return (
    <Pagination aria-label="Pages, as a barcode" className="w-[min(30rem,100%)] min-w-56">
      <PaginationContent variant="barcode">
        <PaginationItem><PaginationPrevious {...(page > 1 ? go(page - 1) : {})} /></PaginationItem>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <PaginationItem key={n}><PaginationLink {...go(n)} aria-label={`Page ${n} of ${total}`} isActive={n === page}>{pad(n)}</PaginationLink></PaginationItem>
        ))}
        <PaginationItem><PaginationNext {...(page < total ? go(page + 1) : {})} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
const filled = new Set("ABCDEFGHIKLMNOPRSTW".split("")) // the letters a glossary has entries under

function Thumb({ at, go = () => ({ href: "?letter" }), force }: { at: string; go?: (l: string) => { href: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> }; force?: string }) {
  return (
    <Pagination aria-label="Glossary, by letter" className="max-w-full">
      <PaginationContent variant="thumb">
        {letters.map((l) =>
          filled.has(l) ? (
            <PaginationItem key={l}><PaginationLink {...go(l)} aria-label={`Letter ${l}`} isActive={l === at} data-force={l === "N" ? force : undefined}>{l}</PaginationLink></PaginationItem>
          ) : (
            <PaginationItem key={l} aria-hidden="true">{l}</PaginationItem>
          ),
        )}
      </PaginationContent>
    </Pagination>
  )
}

function Neighbours({ at, go = () => ({ href: "?chapter" }), force }: { at: number; go?: Go; force?: string }) {
  return (
    <Pagination aria-label="Chapters" className="w-[min(28rem,100%)]">
      <PaginationContent variant="neighbours" className="w-full">
        {at > 0 && <PaginationItem><PaginationPrevious {...go(at - 1)} data-force={force}>{chapters[at - 1]}</PaginationPrevious></PaginationItem>}
        {at < chapters.length - 1 && <PaginationItem><PaginationNext {...go(at + 1)}>{chapters[at + 1]}</PaginationNext></PaginationItem>}
      </PaginationContent>
    </Pagination>
  )
}

// One place, set four ways: the numbers, the folio and the barcode share a page, so turning one turns them all.
export default function Example() {
  const [page, go] = usePage(7)
  const [at, goChapter] = usePage(1, (n) => `?chapter=${chapters[n].toLowerCase()}`)
  const [letter, goLetter] = usePage(12, (n) => `?letter=${letters[n].toLowerCase()}`)
  return (
    <div className="grid w-full justify-items-start gap-12">
      <div className="grid justify-items-start gap-3">
        <span className="ot-label">Numbers, a long run</span>
        <Numbers page={page} go={go} total={24} />
      </div>
      <div className="grid justify-items-start gap-3">
        <span className="ot-label">Folio</span>
        <Folio page={page} go={go} total={24} />
      </div>
      <div className="grid w-full justify-items-start gap-3">
        <span className="ot-label">Barcode</span>
        <Barcode page={page} go={go} total={24} />
      </div>
      <div className="grid w-full justify-items-start gap-3">
        <span className="ot-label">Neighbours</span>
        <Neighbours at={at} go={goChapter} />
      </div>
      <div className="grid w-full justify-items-start gap-3">
        <span className="ot-label">Thumb index</span>
        <Thumb at={letters[letter]} go={(l) => goLetter(letters.indexOf(l))} />
      </div>
    </div>
  )
}

const inert = () => ({ href: "?page" })

export function States() {
  return (
    <>
      <State label="Current"><Pagination><PaginationContent><PaginationItem><PaginationLink href="?page=1" aria-label="Page 1" isActive>01</PaginationLink></PaginationItem></PaginationContent></Pagination></State>
      <State label="Pointed at"><Pagination><PaginationContent><PaginationItem><PaginationLink href="?page=2" aria-label="Page 2" data-force="hover">02</PaginationLink></PaginationItem></PaginationContent></Pagination></State>
      <State label="First page"><Pagination><PaginationContent><PaginationItem><PaginationPrevious /></PaginationItem><PaginationItem><PaginationNext href="?page=2" /></PaginationItem></PaginationContent></Pagination></State>
      <State label="Folio, last page"><Folio page={12} go={inert} total={12} /></State>
      <State label="Neighbours, pointed at"><Neighbours at={2} force="hover" /></State>
      <State label="Barcode, first page"><Barcode page={1} go={inert} total={12} /></State>
      <State label="Barcode, pointed at"><BarcodePointed /></State>
      <State label="Thumb index, pointed at N"><Thumb at="C" force="hover" /></State>
    </>
  )
}

function BarcodePointed() {
  return (
    <Pagination aria-label="Pages, as a barcode" className="w-56">
      <PaginationContent variant="barcode">
        <PaginationItem><PaginationPrevious href="?page=4" /></PaginationItem>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <PaginationItem key={n}><PaginationLink href={`?page=${n}`} aria-label={`Page ${n} of 12`} isActive={n === 5} data-force={n === 9 ? "hover" : undefined}>{pad(n)}</PaginationLink></PaginationItem>
        ))}
        <PaginationItem><PaginationNext href="?page=6" /></PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
