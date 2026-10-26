export type Movement = "II" | "IV" | "VI" | "VII" | "VIII" | "IX" | "X" | "XI"

export type Prop = { name: string; type: string; default?: string; description: string }

export type ComponentMeta = {
  /** Registry item name, shadcn's name where shadcn has the component. */
  name: string
  title: string
  movement: Movement
  /** The class that heads this item's contract in DESIGN.md, e.g. "ot-btn". */
  contract: string
  /** One sentence: the item's idea. */
  summary: string
  underneath: "native" | "hook" | "radix" | "cmdk"
  props: Prop[]
  /** Siblings whose classes or keyframes this item's CSS relies on without importing them. */
  uses?: string[]
  /** Additional UI modules installed as part of this item, without separate registry entries. */
  parts?: string[]
}

export const defineComponent = (meta: ComponentMeta) => meta
