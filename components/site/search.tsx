"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { Button } from "@/registry/0nlytype/ui/button"
import { Kbd } from "@/registry/0nlytype/ui/kbd"

const SearchDialog = dynamic(() => import("./search-dialog").then((m) => m.SearchDialog))

export type SearchGroup = { heading: string; entries: { label: string; href: string; hint?: string; keywords?: string[] }[] }

/** ⌘K: every item, page and token, matched by cmdk. */
export function Search({ groups }: { groups: SearchGroup[] }) {
  const [open, setOpen] = React.useState(false)
  const [requested, setRequested] = React.useState(false)
  const button = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setRequested(true); setOpen((o) => !o) }
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <Button ref={button} variant="quiet" className="bar-search" onClick={() => { setRequested(true); setOpen(true) }} aria-keyshortcuts="Meta+K Control+K">
        Search <Kbd dir="ltr">⌘K</Kbd>
      </Button>
      {requested ? <SearchDialog groups={groups} open={open} onOpenChange={setOpen} onCloseAutoFocus={(e) => { e.preventDefault(); button.current?.focus() }} /> : null}
    </>
  )
}
