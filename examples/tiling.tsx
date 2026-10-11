"use client"

import * as React from "react"

import { Tile, Tiling, TilingEditor, type TilingLayout } from "@/registry/0nlytype/ui/tiling"
import { State } from "@/components/site/state"

const word = "ot-fff font-medium text-(--ot-ink)"
const note = "ot-pp max-w-[18ch] text-(--ot-graphite)"
const arrangement: TilingLayout = [
  { id: "less", label: "Less", column: 1, row: 1, span: 7, rows: 2 },
  { id: "space", label: "Space", column: 9, row: 1, span: 4, rows: 3 },
  { id: "but", label: "but", column: 1, row: 3, span: 4, rows: 1 },
  { id: "better", label: "better.", column: 1, row: 4, span: 7, rows: 1 },
]
const small: TilingLayout = [
  { id: "space", label: "Space", column: 1, row: 1, span: 4, rows: 1 },
  { id: "type", label: "Type", column: 7, row: 2, span: 5, rows: 1 },
]

export default function Example() {
  const [layout, setLayout] = React.useState(arrangement)
  return (
    <div className="grid w-full gap-(--ot-space-9)">
      <TilingEditor label="Make room for your own arrangement" value={layout} onValueChange={setLayout} copyLayout />
      {/* One sheet after "Less is more.": the headline set a word to a tile, the notes kept to the corners, a large number at the foot. */}
      <Tiling aria-label="Less but better">
        <Tile span={8}>
          <p className={note}>Fewer things, more meaning</p>
          <p className={`${word} mt-(--ot-space-7)`}>Less</p>
        </Tile>
        <Tile span={4} rows={3} place="end-top">
          <p className={note}>Space does the layout</p>
          <p className="ot-p mt-auto max-w-[16ch] text-(--ot-ink)">Take something away before adding anything, and the line that is left means more.</p>
        </Tile>
        <Tile span={8} place="start-foot">
          <p className={word}>but</p>
        </Tile>
        <Tile span={8} place="start-foot">
          <p className={word}>better.</p>
        </Tile>
        <Tile span={4} place="start-foot">
          <span aria-hidden="true" className="mb-(--ot-space-4) block h-(--ot-stroke) w-(--ot-space-5) bg-(--ot-ink)" />
          <p className={note}>Focus on what matters</p>
        </Tile>
        <Tile span={4}>
          <p className="ot-pp text-(--ot-graphite)">Clarity<br />Purpose<br />Silence<br />Type</p>
        </Tile>
        <Tile span={4} place="end-foot">
          <p className="ot-ff font-light tabular-nums text-(--ot-ink)">01</p>
        </Tile>
      </Tiling>
      {/* crosses: the same space, no lines, a registration cross at every corner. */}
      <Tiling variant="crosses" aria-label="Services">
        {[
          ["Identity", "Names, marks, and the rules that keep them from drifting."],
          ["Websites", "Built to be read slowly and used for years."],
          ["Motion", "Titles that move once, and mean it."],
        ].map(([name, body]) => (
          <Tile key={name}>
            <p className="ot-mf font-light text-(--ot-ink)">{name}</p>
            <p className="ot-p mt-(--ot-space-3) max-w-[26ch] text-(--ot-graphite)">{body}</p>
          </Tile>
        ))}
      </Tiling>
    </div>
  )
}

const cells = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <Tile key={i} span={i === 0 ? 8 : 4} place={i % 2 ? "end-foot" : "start-top"}>
      <span className="ot-pp tabular-nums text-(--ot-graphite)">{String(i + 1).padStart(2, "0")}</span>
    </Tile>
  ))

export function States() {
  const [chosen, setChosen] = React.useState("")
  return (
    <>
      <State label="Rules">
        <Tiling className="w-[26rem] max-w-full">{cells(5)}</Tiling>
      </State>
      <State label="Crosses">
        <div className="max-w-full p-(--ot-space-5)">
          <Tiling variant="crosses" className="w-[26rem] max-w-full">{cells(5)}</Tiling>
        </div>
      </State>
      <State label="One row, no lines outside">
        <Tiling className="w-[26rem] max-w-full">
          {["01", "02"].map((n) => (
            <Tile key={n} span={6}>
              <span className="ot-pp tabular-nums text-(--ot-graphite)">{n}</span>
            </Tile>
          ))}
        </Tiling>
      </State>
      <State label="Right to left">
        <Tiling dir="rtl" className="w-[26rem] max-w-full">{cells(5)}</Tiling>
      </State>
      <State label="Editing, rules">
        <div className="w-[48rem] max-w-full"><TilingEditor label="A sheet to arrange" defaultValue={small} copyLayout /></div>
      </State>
      <State label="Holding, crosses">
        <div className="w-[48rem] max-w-full"><TilingEditor label="Space, picked up" variant="crosses" defaultValue={small} defaultHeld="space" /></div>
      </State>
      <State label="Editing, right to left">
        <div className="w-[48rem] max-w-full"><TilingEditor dir="rtl" label="مساحة للكلمات" copyLayout defaultValue={[
          { id: "space", label: "مساحة", column: 1, row: 1, span: 4, rows: 1 },
          { id: "type", label: "كلمات", column: 7, row: 2, span: 5, rows: 1 },
        ]} /></div>
      </State>
      <State label="Content stays clickable">
        <div className="w-[48rem] max-w-full">
          <TilingEditor label="Choose a word, or drag it" defaultValue={small} copyLayout renderTile={(tile) => <button type="button" onClick={() => setChosen(tile.label)}>Choose {tile.label}</button>} />
          <p className="ot-pp" role="status">{chosen ? `${chosen} chosen.` : "Choose a word."}</p>
        </div>
      </State>
      <State label="Empty, ready for a tile">
        <div className="w-[48rem] max-w-full"><TilingEditor label="Your first arrangement" defaultValue={[]} copyLayout /></div>
      </State>
    </>
  )
}
