import { defineComponent } from "./types"

export default defineComponent({
  name: "command",
  title: "Command",
  movement: "VIII",
  contract: "ot-command",
  summary: "What you type is set as large as a headline, in italic. Matches are marked; the chosen row steps forward. Or every row set on one axis at its match, as a mesostic; or the groups run on, as a book's index.",
  underneath: "cmdk",
  props: [
    { name: "variant", type: '"headline" | "mesostic" | "index"', default: '"headline"', description: "On Command or CommandDialog. headline: your query set large, the rows under it. mesostic: every row aligned on one axis at the place your words appear, the found letters in roman capitals, your query on the same axis above. index: each group's name in the margin, its rows run on after it as one paragraph, parted by semicolons." },
    { name: "defaultSearch", type: "string", default: '""', description: "On Command or CommandDialog. What the input holds when it opens, for a palette that starts from a query." },
    { name: "CommandDialog open / onOpenChange", type: "boolean / (open) => void", description: "The ⌘K palette as a modal (Radix Dialog). It opens where you tell it; register ⌘K / Ctrl+K yourself." },
    { name: "CommandDialog onCloseAutoFocus", type: "(event: Event) => void", description: "Where focus goes when the palette closes. By default it returns to what had focus when it opened, which is the page itself if a key opened it; preventDefault and focus your own trigger instead." },
    { name: "CommandDialog title", type: "string", default: '"Search"', description: "Read out by screen readers; not shown." },
    { name: "CommandItem value / keywords / onSelect", type: "string / string[] / () => void", description: "What the row is called, other words that find it, and what Enter does. A row matches when what you typed sits inside its value or keywords, and the words in it are marked." },
    { name: "CommandGroup heading", type: "ReactNode", description: "A small heading over a group of rows." },
    { name: "CommandEmpty", type: "ReactNode", description: "Shown when nothing matches. Name something to try." },
    { name: "CommandShortcut", type: "kbd", description: "A key that runs the row, drawn as the corners of a cap." },
    { name: "CommandHint", type: "span", description: "A quiet word at the end of a row that isn't a key: a year, a kind." },
    { name: "filter", type: "(value, search, keywords) => number", description: "On Command. Replaces the substring match; the highlighter still marks what you typed." },
  ],
})
