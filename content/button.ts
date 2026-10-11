import { defineComponent } from "./types"

export default defineComponent({
  name: "button",
  title: "Button",
  movement: "VI",
  contract: "ot-btn",
  summary: "One family of three (a statement in an ink block, a bracket that steps apart, a quiet line that redraws), four heroes for the big call to action (overture, crescendo, stave and ink), and two measures: space and repeat. Nothing moves its neighbours.",
  underneath: "native",
  props: [
    { name: "variant", type: '"statement" | "bracket" | "quiet" | "overture" | "crescendo" | "stave" | "ink" | "space" | "repeat"', default: '"bracket"', description: "The family: statement is reversed type in an ink block, one per view; bracket holds a secondary action; quiet is only a line. The heroes: overture swells from light to heavy and ends in a full stop; crescendo opens a hairpin under the word as the word swells a weight; stave sets the word in italic between two staves that run out to the edges; ink is an outlined block that fills from the side you came in. The measures: space spreads the words across the whole line, and pointing gathers them at its end while the silence they leave becomes the arrow that leads to them; repeat sets the word between repeat signs, for doing something again, and pointing sets the opening dots." },
    { name: "size", type: '"m" | "l"', default: '"m"', description: "Large sets the label one step up (the heroes, two). On a phone the heroes step down one size so the widest still fits." },
    { name: "busy", type: "boolean | string", default: "false", description: "The button says what it's doing. A string replaces the label while busy (Save becomes Saving); the periods breathe after it." },
    { name: "asChild", type: "boolean", default: "false", description: "Render the child element, such as a link, with the button's look." },
  ],
})
