"use client"

import * as React from "react"

import { Button } from "@/registry/0nlytype/ui/button"
import { Field, Input } from "@/registry/0nlytype/ui/field"
import { Meta } from "@/registry/0nlytype/ui/meta"
import { Tour, TourContent, TourStep, TourTrigger } from "@/registry/0nlytype/ui/tour"
import { State } from "@/components/site/state"

export default function Example() {
  const title = React.useRef<HTMLDivElement>(null)
  const send = React.useRef<HTMLButtonElement>(null)
  return (
    <div className="grid w-full max-w-xl gap-y-10">
      <Meta id="tour-draft-meta">
        <span>Draft</span>
        <span>Saved a minute ago</span>
      </Meta>
      <div ref={title}>
        <Field label="Working title">
          <Input defaultValue="Notes on the crossing" autoComplete="off" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Tour>
          <TourTrigger asChild>
            <Button variant="quiet">Show me round</Button>
          </TourTrigger>
          <TourContent>
            <TourStep title="A draft of your own">Four things to know before you send it. Next, or the arrow keys, to go on; Escape to stop.</TourStep>
            <TourStep target="#tour-draft-meta" title="Where it stands">The frame row says what this is and when it was last kept. It saves as you write.</TourStep>
            <TourStep target={title} title="Its name">Say what it is about. You can change it until the day it goes out.</TourStep>
            <TourStep target={send} title="Send it">Nothing leaves until you press this, and you can take it back for an hour after.</TourStep>
          </TourContent>
        </Tour>
        <Button ref={send} variant="bracket">Send the draft</Button>
      </div>
    </div>
  )
}

/** A step drawn still, in the page: a word, the leader and the callout. */
function Still({ at, of, last, force }: { at: number; of: number; last?: boolean; force?: string }) {
  return (
    <div style={{ position: "relative", width: "min(20rem, calc(100vw - 5.2rem))", height: "13rem" }}>
      <span style={{ position: "absolute", left: 0, top: 0, color: "var(--ot-ink)" }}>Send the draft</span>
      <svg className="ot-tour-lead" aria-hidden="true">
        <line className="ot-tour-line" x1="56" y1="26" x2="130" y2="84" pathLength={1} />
        <circle className="ot-tour-dot" cx="56" cy="26" r={3.5} />
      </svg>
      <div className="ot-tour-callout" data-laid="" style={{ left: "min(112px, calc(100vw - 5.2rem - 13rem))", top: 84, animation: "none", maxInlineSize: "13rem" }}>
        <div className="ot-tour-head">
          <p className="ot-tour-title">Send it</p>
          <span className="ot-tour-count">0{at}/0{of}</span>
        </div>
        <p className="ot-tour-text">Nothing leaves until you press this.</p>
        <div className="ot-tour-actions">
          <button type="button" className="ot-tour-end">End</button>
          <button type="button" data-go="back">Back</button>
          <button type="button" data-go="next" data-last={last ? "" : undefined} data-force={force}>{last ? "Done" : "Next"}</button>
        </div>
      </div>
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="A step"><Still at={3} of={4} /></State>
      <State label="Next, focus"><Still at={3} of={4} force="focus" /></State>
      <State label="The last step"><Still at={4} of={4} last force="hover" /></State>
    </>
  )
}
