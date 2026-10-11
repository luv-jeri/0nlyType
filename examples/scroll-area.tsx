import { ScrollArea } from "@/registry/0nlytype/ui/scroll-area"
import { State } from "@/components/site/state"

const releases = [
  { version: "0.4", name: "The library", notes: ["Every component in one stylesheet, fenced for the library.", "Right-to-left support for crumbs, checkboxes and fields."] },
  { version: "0.3", name: "Colour", notes: ["Four type pairs and five colour schemes."] },
  { version: "0.2", name: "Motion", notes: ["Motion that answers the hand, and rests.", "The overture: text that parts around the pause."] },
  { version: "0.1", name: "Posters", notes: ["Twenty posters pinned to a wall.", "One rule: ours in roman, yours in italic."] },
  { version: "0.0", name: "A name", notes: ["A name, taken from music."] },
]

const idea = [
  "Everything is type. The library gives an interface two typefaces, one accent and a great deal of space to lean on, and takes every picture away.",
  "Space does the layout. Where a box would say that things belong together, the gap between them says it first, and more quietly.",
  "Type is the only ornament. A word can be large or small, roman or italic, ink or pencil, and that is all the decoration there is.",
  "One colour marks where you are. If two things on the page were in the accent, there would be two places to be.",
  "Nothing moves unless you do. The page waits, the way a room waits for someone to speak.",
]

const dynamics = [
  ["ppp", "As soft as it can be played"],
  ["pp", "Very soft"],
  ["p", "Soft"],
  ["mp", "Moderately soft"],
  ["mf", "Moderately loud"],
  ["f", "Loud"],
  ["ff", "Very loud"],
  ["fff", "As loud as it can be played"],
  ["fp", "Loud, then at once soft"],
  ["sfz", "A sudden weight on one note"],
  ["cresc.", "Growing louder"],
  ["dim.", "Growing softer"],
]

function Idea() {
  return (
    <div className="grid gap-[var(--ot-space-4)] py-[var(--ot-space-3)] pe-[var(--ot-space-6)]">
      {idea.map((t) => <p key={t}>{t}</p>)}
    </div>
  )
}

function Dynamics({ rows = dynamics }: { rows?: string[][] }) {
  return (
    <ul className="grid gap-[var(--ot-space-2)] py-[var(--ot-space-6)]">
      {rows.map(([mark, meaning]) => (
        <li key={mark}>
          <span className="inline-block w-14 tabular-nums">{mark}</span>
          {meaning}
        </li>
      ))}
    </ul>
  )
}

/** Ruled: each release is a section, and a mark on the rail. Catchword: the first word below waits on the foot rule. Wheel: the dynamics turn on an arc. */
export default function Example() {
  return (
    <div className="grid items-start gap-x-(--ot-space-8) gap-y-(--ot-space-7) md:grid-cols-2">
      <ScrollArea
        aria-label="Release notes"
        sections={releases.map((r) => ({ id: `release-${r.version}`, num: r.version, name: r.name }))}
        className="max-h-56 max-w-xl md:col-span-2"
      >
        <div className="grid gap-[var(--ot-space-5)] py-[var(--ot-space-4)] pe-[var(--ot-space-6)]">
          {releases.map((r) => (
            <section key={r.version} id={`release-${r.version}`} aria-labelledby={`release-${r.version}-h`}>
              <h3 id={`release-${r.version}-h`}>
                <span className="inline-block w-10 tabular-nums">{r.version}</span>
                {r.name}
              </h3>
              <ul className="grid gap-1 ps-10">
                {r.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ScrollArea>
      <ScrollArea variant="catchword" aria-label="The idea" className="max-h-56">
        <Idea />
      </ScrollArea>
      <ScrollArea variant="wheel" aria-label="Dynamics" className="max-h-56">
        <Dynamics />
      </ScrollArea>
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="Sideways">
        <ScrollArea aria-label="Release notes, sideways" sections={releases.map((r) => ({ id: `across-${r.version}`, num: r.version, name: r.name }))} className="w-full max-w-md">
          <div className="flex w-max gap-[var(--ot-space-6)] pe-[var(--ot-space-4)] pb-[var(--ot-space-6)]">
            {releases.map((r) => (
              <section key={r.version} id={`across-${r.version}`} aria-label={`${r.version} ${r.name}`} className="grid w-44 content-start gap-1">
                <p className="text-[var(--ot-ink)]">
                  <span className="inline-block w-10 tabular-nums">{r.version}</span>
                  {r.name}
                </p>
                {r.notes.map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </section>
            ))}
          </div>
        </ScrollArea>
      </State>
      <State label="Catchword">
        <ScrollArea variant="catchword" aria-label="The idea, narrow" className="max-h-40 w-64">
          <Idea />
        </ScrollArea>
      </State>
      <State label="Catchword, right to left">
        <ScrollArea variant="catchword" dir="rtl" aria-label="Right to left" className="max-h-32 w-64">
          <div className="grid gap-[var(--ot-space-3)] py-[var(--ot-space-3)] pe-[var(--ot-space-6)]">
            <p>صفر ديسيبل هو أهدأ صوت يمكن أن يسمعه الإنسان.</p>
            <p>المسافة ترتّب الصفحة، والحرف هو الزينة الوحيدة.</p>
            <p>لون واحد يدلّ على مكانك، ولا شيء غيره.</p>
            <p>لا شيء يتحرّك ما لم تتحرّك أنت.</p>
          </div>
        </ScrollArea>
      </State>
      <State label="Wheel">
        <ScrollArea variant="wheel" aria-label="Dynamics, short" className="max-h-40 w-80 max-w-full">
          <Dynamics rows={dynamics.slice(0, 8)} />
        </ScrollArea>
      </State>
      <State label="Wheel, right to left">
        <ScrollArea variant="wheel" dir="rtl" aria-label="Dynamics, right to left" className="max-h-40 w-80 max-w-full">
          <Dynamics rows={dynamics.slice(0, 8)} />
        </ScrollArea>
      </State>
      <State label="Without sections">
        <ScrollArea aria-label="Release notes, unmarked" className="max-h-32 max-w-xs">
          <ul className="grid gap-1 py-[var(--ot-space-3)] pe-[var(--ot-space-6)]">
            {releases.flatMap((r) => r.notes).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </ScrollArea>
      </State>
    </>
  )
}
