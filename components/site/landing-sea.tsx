import { TuneSentence } from "@/components/site/landing"
import { Sec } from "@/components/site/landing-section"

// 03, one sentence that retunes the page.
export function Sea() {
  return (
    <Sec id="tune" num="03" name="Tune" title="One sentence retunes the page." note="Every italic word is a choice. Change one, and everything follows.">
      <TuneSentence />
    </Sec>
  )
}
