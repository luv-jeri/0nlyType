import { defineComponent } from "./types"

export default defineComponent({
  name: "pagination",
  title: "Pagination",
  movement: "VIII",
  contract: "ot-pager",
  summary: "Numbers with a dot beneath each, weight falling away from the current page and its accent dot; or a folio, the page over its total; the neighbours, by name; every page as a barcode's line; or an alphabet set as one word.",
  underneath: "native",
  props: [
    { name: "PaginationContent variant", type: '"numbers" | "folio" | "neighbours" | "barcode" | "thumb"', default: '"numbers"', description: "numbers: every page shown, a dot under each; on a phone the steps keep only their arrows. folio: the current page over the total, arrows either side. neighbours: the pages either side by name, at the two ends of the line, each hung on a hairline arrow. barcode: every page a hairline, behind you in ink, ahead in pencil, yours tall in the accent with its number above. thumb: letters instead of pages, the alphabet set as one heavy word with the current letter reversed out." },
    { name: "paginationRange(current, total, siblings?)", type: '(number | "gap")[]', default: "siblings 1", description: "The pages to show for a long run: the ends, the current page and its siblings, and \"gap\" where pages are left out. Always the same number of slots, so nothing beside the pager moves as you page." },
    { name: "PaginationLink href / isActive", type: "string / boolean", description: "A page. isActive sets aria-current=\"page\", which draws the accent dot. Give it an aria-label that holds the number as shown, such as \"Page 03\" for 03." },
    { name: "PaginationLink asChild", type: "boolean", default: "false", description: "Render your own link (Next's Link, say) with the pager's look." },
    { name: "PaginationPrevious / PaginationNext href", type: "string", description: "Where the step goes. Omit it on the first or last page and the step shows, unavailable." },
    { name: "PaginationPrevious / PaginationNext children", type: "ReactNode", default: '"Previous" / "Next"', description: "Pass a neighbour's name instead (Halden). The arrow is drawn for you, and the accessible name gains its direction." },
    { name: "PaginationEllipsis", type: "span", description: "Pages left out. Read out as \"More pages\"." },
    { name: "folio: the total", type: "PaginationItem", description: "In a folio, the item after the current page holds the total as plain text, aria-hidden; the current page's aria-label says it (\"Page 7 of 24\")." },
    { name: "neighbours: the steps", type: "PaginationPrevious / PaginationNext", description: "Pass each neighbour's name; the direction is set small above it. Leave out a step with nowhere to go." },
    { name: "barcode: the pages", type: "PaginationLink", description: "Pass every page, no gaps, each named \"Page 9 of 24\". Only the current number shows; pointing or focus shows another's in its place. Give the nav a width: the lines share it, up to 18px apart. Best to about 40 pages." },
    { name: "thumb: the letters", type: "PaginationLink / PaginationItem", description: "A letter with entries is a PaginationLink (aria-label \"Letter M\"). A letter with none is a PaginationItem holding the bare letter, aria-hidden, so it stays in the word but isn't read out or reached. On a phone the word breaks 13 and 13." },
  ],
})
