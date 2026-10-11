"use client"

import * as React from "react"

import { WordRelay } from "@/registry/0nlytype/ui/word-relay"
import { State, Still } from "@/components/site/state"

const ends = ["design.", "type.", "silence.", "yours."]

export default function Example() {
  const [pace, setPace] = React.useState(1)
  const still = React.useContext(Still)
  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)] justify-items-start gap-(--ot-space-8)">
      <p className="ot-ff" style={{ margin: 0, fontSize: "clamp(36px, 10vw, var(--ot-ff))" }}>
        <WordRelay autoplay={!still} variant="statement" words={ends}>It has to be</WordRelay>
      </p>
      <div className="grid gap-(--ot-space-3)">
        <p className="ot-mp" style={{ margin: 0 }}>
          <WordRelay autoplay={!still} words={["slowly.", "at a walk.", "at a run."]} index={pace} onIndexChange={setPace}>Read the page</WordRelay>
        </p>
        <p className="ot-pp" style={{ margin: 0, color: "var(--ot-pencil)" }}>A new word every 2.4 seconds. Press the sentence or use the arrow keys to take over; pause lets it rest.</p>
      </div>
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="Autoplaying"><p className="ot-mp" style={{ margin: 0 }}><WordRelay words={ends}>It has to be</WordRelay></p></State>
      <State label="Paused"><p className="ot-mp" style={{ margin: 0 }}><WordRelay defaultPaused words={ends}>It has to be</WordRelay></p></State>
      <State label="Reduced motion"><p className="ot-mp" style={{ margin: 0 }}><WordRelay data-force="reduced" words={ends}>It has to be</WordRelay></p></State>
      <State label="A slower reading"><p className="ot-mp" style={{ margin: 0 }}><WordRelay interval={4000} words={ends}>It has to be</WordRelay></p></State>
      <State label="Press only"><p className="ot-mp" style={{ margin: 0 }}><WordRelay autoplay={false} words={ends}>It has to be</WordRelay></p></State>
      <State label="Hover"><p className="ot-mp" style={{ margin: 0 }}><WordRelay words={ends} data-force="hover">It has to be</WordRelay></p></State>
      <State label="Focus"><p className="ot-mp" style={{ margin: 0 }}><WordRelay words={ends} data-force="focus">It has to be</WordRelay></p></State>
      <State label="Disabled"><p className="ot-mp" style={{ margin: 0 }}><WordRelay words={ends} disabled>It has to be</WordRelay></p></State>
      <State label="Statement"><p className="ot-f" style={{ margin: 0 }}><WordRelay variant="statement" words={ends} defaultIndex={2}>It has to be</WordRelay></p></State>
      <State label="Statement, hover"><p className="ot-f" style={{ margin: 0 }}><WordRelay variant="statement" words={ends} data-force="hover">It has to be</WordRelay></p></State>
    </>
  )
}
