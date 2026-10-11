"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/registry/0nlytype/lib/utils"
import { Scrollbar } from "@/registry/0nlytype/ui/scrollbar"

const SearchContext = React.createContext("")
const SearchSetter = React.createContext<(search: string) => void>(() => {})

// A row matches when the words you typed sit inside its value or keywords.
// ponytail: substring, not cmdk's fuzzy score, so the highlighter can mark exactly what matched.
const contains = (value: string, search: string, keywords?: string[]) =>
  [value, ...(keywords ?? [])].join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0

/** The highlighter: wraps each place the query appears in <mark>. */
function marks(text: string, q: string): React.ReactNode {
  if (!q) return text
  const lower = text.toLowerCase()
  const out: React.ReactNode[] = []
  let at = 0
  for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, at)) {
    if (i > at) out.push(text.slice(at, i))
    out.push(<mark key={i}>{text.slice(i, i + q.length)}</mark>)
    at = i + q.length
  }
  out.push(text.slice(at))
  return out
}

/** The name split at its first match: what comes before, then the key (the match onward). The mesostic sets the key on its axis; elsewhere the two run on. */
function marked(text: string, query: string): React.ReactNode {
  const q = query.trim().toLowerCase()
  const at = Math.max(q ? text.toLowerCase().indexOf(q) : 0, 0)
  return (
    <>
      <span className="ot-command-before">{text.slice(0, at)}</span>
      <span className="ot-command-key">{marks(text.slice(at), q)}</span>
    </>
  )
}

type CommandProps = React.ComponentProps<typeof CommandPrimitive> & {
  /** headline: what you type set large, rows below. mesostic: every row set on one axis at its match. index: each group run on as a book's index. */
  variant?: "headline" | "mesostic" | "index"
  /** What the input holds when it opens, for a palette that starts from a query. */
  defaultSearch?: string
}

/** A command palette. What you type is set large and italic; matches are marked; the chosen row steps forward. */
function Command({ className, filter = contains, variant = "headline", defaultSearch = "", ...props }: CommandProps) {
  const [search, setSearch] = React.useState(defaultSearch)
  return (
    <SearchContext.Provider value={search}>
      <SearchSetter.Provider value={setSearch}>
        <CommandPrimitive data-slot="command" data-variant={variant} filter={filter} className={cn("ot-command", className)} {...props} />
      </SearchSetter.Provider>
    </SearchContext.Provider>
  )
}
/** What you type is yours, so it is italic and as large as a headline. Give it a placeholder that names what to type. */
function CommandInput({ className, onValueChange, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  const search = React.useContext(SearchContext)
  const setSearch = React.useContext(SearchSetter)
  return (
    <CommandPrimitive.Input
      data-slot="command-input"
      aria-label={props["aria-label"] ?? props.placeholder}
      value={search}
      onValueChange={(next) => {
        setSearch(next)
        onValueChange?.(next)
      }}
      className={cn("ot-command-input", className)}
      {...props}
    />
  )
}

/** The rows, on the scrollbar's rail when there are more than fit. */
function CommandList({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List data-slot="command-list" className={cn("ot-command-list", className)} {...props}>
      {children}
      <Scrollbar />
    </CommandPrimitive.List>
  )
}

/** Empty copy names something to try. */
function CommandEmpty({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  const search = React.useContext(SearchContext)
  return (
    <CommandPrimitive.Empty data-slot="command-empty" className={cn("ot-command-empty", className)} {...props}>
      {children ?? <>Nothing matches “{search}”.</>}
    </CommandPrimitive.Empty>
  )
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group data-slot="command-group" className={cn("ot-command-group", className)} {...props} />
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator data-slot="command-separator" className={cn("ot-command-separator", className)} {...props} />
}

/** A row. Words in it are set as the name and marked where they match; other parts (CommandHint, CommandShortcut) sit at the end. */
function CommandItem({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  const search = React.useContext(SearchContext)
  return (
    <CommandPrimitive.Item data-slot="command-item" className={cn("ot-command-option", className)} {...props}>
      {React.Children.map(children, (child) =>
        typeof child === "string" ? <span className="ot-command-name">{marked(child, search)}</span> : child,
      )}
    </CommandPrimitive.Item>
  )
}

/** A key that runs the row, drawn as a cap (base ot-kbd). */
function CommandShortcut({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd data-slot="command-shortcut" className={cn("ot-kbd", className)} {...props} />
}

/** A quiet word at the end of a row, when it isn't a key: a year, a kind. */
function CommandHint({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="command-hint" className={cn("ot-command-hint", className)} {...props} />
}

type CommandDialogProps = CommandProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Read out by screen readers; not shown. */
  title?: string
  /** Where focus goes when the palette closes. By default it returns to what had focus when it opened, which is the page itself if a key opened it; preventDefault and focus your trigger instead. */
  onCloseAutoFocus?: (event: Event) => void
}

/** The ⌘K palette: a modal over the page. Register the key yourself; this only opens where you tell it. */
function CommandDialog({ open, onOpenChange, title = "Search", onCloseAutoFocus, children, ...props }: CommandDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-slot="command-overlay" className="ot-command-overlay" />
        <DialogPrimitive.Content data-slot="command-dialog" aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus} className="ot-command-dialog ot-corners">
          <DialogPrimitive.Title className="ot-sr">{title}</DialogPrimitive.Title>
          <Command {...props}>{children}</Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
  CommandHint,
  type CommandProps,
  type CommandDialogProps,
}
