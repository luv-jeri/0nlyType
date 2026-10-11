import * as React from "react"

import { Marquee } from "@/registry/0nlytype/ui/marquee"
import { State, Still } from "@/components/site/state"

const words = ["Silence", "Space", "Type", "Rest", "Line", "Measure"]

export default function Example() {
  const still = React.useContext(Still)
  return (
    <div className="grid gap-y-16">
      <Marquee autoplay={!still} className="ot-fff" label="What the page is made of">
        {words.map((w) => <span key={w}>{w}</span>)}
      </Marquee>
      <Marquee autoplay={!still} variant="ticker" label="Index">
        {["New era", "Of silence", "Oslo 2026", "Set in Archivo", "Printed on paper", "Read slowly"].map((w) => <span key={w}>{w}</span>)}
      </Marquee>
      <Marquee autoplay={!still} variant="counter" className="ot-fff" label="Both ways">
        {["Spectra", "Point", "Dust", "Hush"].map((w) => <span key={w}>{w}</span>)}
      </Marquee>
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="Autoplaying">
        <Marquee className="ot-f" label="Words" style={{ width: "20rem", maxWidth: "100%" }}>
          {words.map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
      <State label="Paused">
        <Marquee defaultPaused className="ot-f" label="Paused words" style={{ width: "20rem", maxWidth: "100%" }}>
          {words.map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
      <State label="Reduced motion">
        <Marquee data-force="reduced" className="ot-f" label="Still words" style={{ width: "20rem", maxWidth: "100%" }}>
          {words.map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
      <State label="Scroll only">
        <Marquee autoplay={false} className="ot-f" label="Scroll words" style={{ width: "20rem", maxWidth: "100%" }}>
          {words.map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
      <State label="Reverse">
        <Marquee className="ot-f" reverse label="Words, backwards" style={{ width: "20rem", maxWidth: "100%" }}>
          {words.map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
      <State label="Ticker">
        <Marquee variant="ticker" label="Index" style={{ width: "20rem", maxWidth: "100%" }}>
          {["Plate 04", "Oslo", "2026", "Archivo"].map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
      <State label="Counter">
        <Marquee variant="counter" className="ot-f" label="Both ways" style={{ width: "20rem", maxWidth: "100%" }}>
          {words.map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
      <State label="Right to left">
        <Marquee dir="rtl" className="ot-f" label="كلمات" style={{ width: "20rem", maxWidth: "100%" }}>
          {["صمت", "مساحة", "خط", "راحة"].map((w) => <span key={w}>{w}</span>)}
        </Marquee>
      </State>
    </>
  )
}
