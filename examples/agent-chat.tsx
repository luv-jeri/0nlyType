"use client"

import * as React from "react"

import { State } from "@/components/site/state"
import {
  AgentChat,
  AgentChatChoice,
  AgentChatComposer,
  AgentChatHeader,
  AgentChatNote,
  AgentChatPermission,
  AgentChatThread,
  AgentChatWork,
} from "@/registry/0nlytype/ui/agent-chat"
import { type AgentStateValue } from "@/registry/0nlytype/ui/agent-state"
import { Attachment, AttachmentList } from "@/registry/0nlytype/ui/attachment"
import { Dialog } from "@/registry/0nlytype/ui/dialog"
import { Message, MessageAvatar, MessageBody, MessageBubble, MessageHeader, MessageTyping } from "@/registry/0nlytype/ui/message"

type File_ = { id: string; name: string; size?: string }
type Entry =
  | { k: "say"; from: "them" | "you"; text: string; time: string; arriving?: boolean; files?: File_[] }
  | { k: "note"; text: string }
  | { k: "ask" }
  | { k: "work" }
  | { k: "choice" }

function Say({ from, text, time, arriving, files, who = "Ada" }: Omit<Extract<Entry, { k: "say" }>, "k"> & { who?: string }) {
  const you = from === "you"
  return (
    <Message from={from} arriving={arriving}>
      <MessageAvatar alt={you ? "You" : who} />
      <MessageHeader name={you ? "You" : who} time={time} />
      <MessageBody>
        <MessageBubble align={you ? "end" : "start"}>{text}</MessageBubble>
        {files?.length ? (
          <AttachmentList variant="enclosure">
            {files.map((f) => <Attachment key={f.id} name={f.name} size={f.size} />)}
          </AttachmentList>
        ) : null}
      </MessageBody>
    </Message>
  )
}

function Typing({ writing, who = "Ada" }: { writing: boolean; who?: string }) {
  return (
    <Message>
      <MessageAvatar alt={who} />
      <MessageBody><MessageTyping writing={writing} label={`${who} is writing`} /></MessageBody>
    </Message>
  )
}

const ways = [
  { value: "time", label: "By departure time" },
  { value: "harbour", label: "By harbour" },
  { value: "weekday", label: "By weekday" },
]
const later = ["Noted. I'll fold that into the draft.", "Done. The change is in the draft.", "Good. I'll keep the Sunday boats as they were."]
const size = (b: number) => (b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toFixed(1)} MB`)

/** Ask Ada for the winter timetable: she writes back, asks before she reads anything, reads, and asks you to choose. */
function Live() {
  const [entries, setEntries] = React.useState<Entry[]>([
    { k: "say", from: "them", time: "09:40", text: "I'm Ada. I draft timetables from what you already have. What are we working on?" },
  ])
  const [value, setValue] = React.useState("Draft the winter timetable for Halden.")
  const [files, setFiles] = React.useState<File_[]>([{ id: "f0", name: "winter-routes.pdf", size: "1.2 MB" }])
  const [agent, setAgent] = React.useState<{ state: AgentStateValue; words?: string }>({ state: "ready" })
  const [writing, setWriting] = React.useState(false)
  const [decision, setDecision] = React.useState<"pending" | "allowed" | "denied">("pending")
  const [work, setWork] = React.useState(0)
  const [answer, setAnswer] = React.useState<string>()
  const timers = React.useRef<number[]>([])
  const minute = React.useRef(41)
  const said = React.useRef(0)
  React.useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const wait = (ms: number, fn: () => void) => void timers.current.push(window.setTimeout(fn, ms))
  const clock = () => `09:${String(minute.current++).padStart(2, "0")}`
  const push = (e: Entry) => setEntries((all) => [...all, e])
  const reply = (text: string, then?: () => void) => {
    setAgent({ state: "thinking" })
    setWriting(true)
    wait(1100, () => {
      setWriting(false) // the periods go first, then her words write in, before them
      push({ k: "say", from: "them", time: clock(), text, arriving: true })
      if (then) then()
      else setAgent({ state: "ready" })
    })
  }
  const choose = () => {
    push({ k: "choice" })
    setAgent({ state: "input", words: "Needs your choice" })
  }
  const read = (step = 0) => {
    setWork(step / 8)
    if (step < 8) return wait(380, () => read(step + 1))
    push({ k: "note", text: "Read timetable-2025.pdf, 14 pages." })
    choose()
  }

  return (
    <AgentChat aria-label="Ada, the timetable agent" className="w-full">
      <AgentChatHeader title="Ada, the timetable agent" state={agent.state} status={agent.words} />
      <AgentChatThread label="Conversation with Ada">
        {entries.map((e, i) =>
          e.k === "say" ? (
            <Say key={i} {...e} />
          ) : e.k === "note" ? (
            <AgentChatNote key={i}>{e.text}</AgentChatNote>
          ) : e.k === "ask" ? (
            <AgentChatPermission
              key={i}
              title="Read last season's timetable?"
              description="Ada opens timetable-2025.pdf in the Halden folder and reads it. Nothing is changed or sent."
              scope="Halden folder, read only"
              decision={decision}
              onDecision={(d) => {
                setDecision(d)
                if (d === "allowed") {
                  setAgent({ state: "working", words: "Reading last season's timetable" })
                  push({ k: "work" })
                  read()
                } else reply("Then I'll start from the times on the ferry office board.", choose)
              }}
            />
          ) : e.k === "work" ? (
            <AgentChatWork key={i} value={work} max={1} label="Reading last season's timetable" />
          ) : (
            <AgentChatChoice
              key={i}
              question="Which way should the winter timetable read?"
              options={ways}
              answer={answer}
              onConfirm={(v) => {
                setAnswer(v)
                const label = ways.find((w) => w.value === v)?.label ?? v
                push({ k: "say", from: "you", time: clock(), text: `${label}.` })
                reply(`${label} it is. The first draft is on its way.`, () => setAgent({ state: "done", words: "Draft ready" }))
              }}
            />
          ),
        )}
        <Typing writing={writing} />
      </AgentChatThread>
      <AgentChatComposer
        label="Write to Ada"
        placeholder="Ask for a draft, a change, a check"
        value={value}
        onValueChange={setValue}
        busy={agent.state === "thinking" || agent.state === "working"}
        attachments={files}
        onAttach={(list) => setFiles((all) => [...all, ...list.map((f, i) => ({ id: `${f.name}-${Date.now()}-${i}`, name: f.name, size: size(f.size) }))])}
        onRemoveAttachment={(id) => setFiles((all) => all.filter((f) => f.id !== id))}
        onStop={() => {
          timers.current.forEach(clearTimeout)
          timers.current = []
          setWriting(false)
          setAgent({ state: "ready" })
          push({ k: "note", text: "Stopped." })
        }}
        onSend={(text) => {
          push({ k: "say", from: "you", time: clock(), text, files })
          setValue("")
          setFiles([])
          if (said.current++ === 0)
            reply("I'll need last season's timetable for that, so I'll ask before I open it.", () => {
              push({ k: "ask" })
              setAgent({ state: "input", words: "Needs your permission" })
            })
          else reply(later[(said.current - 2) % later.length])
        }}
      />
    </AgentChat>
  )
}

/** A finished exchange, its work and receipts hung out at the far side as Weingart's callouts. */
function Callouts({ className, dir, lang }: { className?: string; dir?: "rtl"; lang?: string }) {
  if (dir === "rtl")
    return (
      <AgentChat variant="callout" aria-label="آدا" dir={dir} lang={lang} className={className}>
        <AgentChatHeader title="آدا، وكيلة الجداول" state="done" status="المسودة جاهزة" />
        <AgentChatThread label="المحادثة مع آدا">
          <Say who="آدا" from="you" time="09:41" text="أعدّي جدول الشتاء لهالدن." />
          <AgentChatNote>فُتح جدول الموسم الماضي، ١٤ صفحة.</AgentChatNote>
          <Say who="آدا" from="them" time="09:44" text="حسب الميناء. المسودة الأولى في طريقها." />
        </AgentChatThread>
        <AgentChatComposer
          label="اكتب إلى آدا"
          sendLabel="أرسل"
          stopLabel="أوقف"
          attachLabel="أرفق"
          sendsLabel="يرسل"
          dropLabel={(n) => `أفلت لإرفاق ${n}.`}
          onAttach={() => {}}
          onSend={() => {}}
        />
      </AgentChat>
    )
  return (
    <AgentChat variant="callout" aria-label="Ada, finished" className={className}>
      <AgentChatHeader title="Ada, the timetable agent" state="done" status="Draft ready" />
      <AgentChatThread label="Finished conversation with Ada">
        <Say from="you" time="09:41" text="Draft the winter timetable for Halden." files={[{ id: "f0", name: "winter-routes.pdf", size: "1.2 MB" }]} />
        <AgentChatNote data-decision="allowed">
          Read last season&rsquo;s timetable? <span className="ot-yours">Allowed once.</span>
        </AgentChatNote>
        <AgentChatWork value={1} max={1} label="Read timetable-2025.pdf, 14 pages" />
        <Say from="them" time="09:43" text="The winter boats leave from three harbours. Which way should it read?" />
        <Say from="you" time="09:43" text="By harbour." />
        <AgentChatNote>Wrote the draft, 6 pages.</AgentChatNote>
        <Say from="them" time="09:44" text="By harbour it is. The first draft is in the Halden folder." />
      </AgentChatThread>
      <AgentChatComposer label="Write to Ada" placeholder="Ask for a change" onSend={() => {}} />
    </AgentChat>
  )
}

export default function Example() {
  return (
    <div className="grid w-full max-w-[72rem] gap-(--ot-space-8) lg:grid-cols-2">
      <div className="grid content-start gap-(--ot-space-4)">
        <Live />
        <p className="ot-pp text-(--ot-pencil)">Send it: Ada writes back, asks before she opens anything, reads, and asks you to choose.</p>
      </div>
      <Callouts />
    </div>
  )
}

const w = "w-[34rem] max-w-full"

export function States() {
  return (
    <>
      <State label="Writing">
        <AgentChat className={`${w} h-[22rem]`} aria-label="Ada, writing">
          <AgentChatHeader title="Ada" state="thinking" />
          <AgentChatThread label="Writing">
            <Say from="you" time="09:41" text="Draft the winter timetable for Halden." />
            <Typing writing />
          </AgentChatThread>
          <AgentChatComposer label="Write to Ada" busy onStop={() => {}} onSend={() => {}} />
        </AgentChat>
      </State>
      <State label="Permission, asked">
        {/* Pinned open in place: a plain, non-modal <dialog open>, as the dialog's own states are. */}
        <Dialog>
          <dialog open className="ot-dialog" data-variant="reply" style={{ position: "static", maxWidth: "100%" }}>
            <div className="ot-meta ot-dialog-meta"><span>Permission</span><hr /><span>Halden folder, read only</span></div>
            <h2 className="ot-dialog-title">Read last season&rsquo;s timetable?</h2>
            <p className="ot-dialog-body">Ada opens timetable-2025.pdf in the Halden folder and reads it. Nothing is changed or sent.</p>
            <div className="ot-dialog-actions">
              <button type="button">Allow once</button>
              <button type="button" data-force="hover">Deny</button>
            </div>
          </dialog>
        </Dialog>
      </State>
      <State label="Permission, receipts">
        <div className={`${w} grid gap-(--ot-space-4)`}>
          <AgentChatNote data-decision="pending" dot={false}>Read last season&rsquo;s timetable? <span>Waiting for your answer.</span></AgentChatNote>
          <AgentChatNote data-decision="allowed">Read last season&rsquo;s timetable? <span className="ot-yours">Allowed once.</span></AgentChatNote>
          <AgentChatNote data-decision="denied">Read last season&rsquo;s timetable? <span className="ot-yours">Denied.</span></AgentChatNote>
        </div>
      </State>
      <State label="Working">
        <div className={w}><AgentChatWork value={0.45} max={1} label="Reading last season's timetable" /></div>
      </State>
      <State label="Choice, open">
        <AgentChatChoice question="Which way should the winter timetable read?" options={ways} defaultValue="harbour" onConfirm={() => {}} />
      </State>
      <State label="Choice, answered">
        <AgentChatChoice question="Which way should the winter timetable read?" options={ways} answer="harbour" onConfirm={() => {}} />
      </State>
      <State label="Composer, files and an error">
        <AgentChatComposer
          className={w}
          label="Write to Ada"
          defaultValue="Here are the routes and the fares."
          attachments={[
            { id: "a", name: "winter-routes.pdf", size: "1.2 MB" },
            { id: "b", name: "fares.xlsx", state: "uploading", progress: 0.4, status: "Uploading" },
          ]}
          onAttach={() => {}}
          onRemoveAttachment={() => {}}
          error="fares.xlsx is over 20 MB. Send a smaller copy."
          onSend={() => {}}
        />
      </State>
      <State label="Composer, disabled">
        <AgentChatComposer className={w} label="Write to Ada" placeholder="Ada is offline" disabled onAttach={() => {}} onSend={() => {}} />
      </State>
      <State label="Callout">
        <Callouts className={`${w} h-[30rem]`} />
      </State>
      <State label="Right to left, callout">
        <Callouts className={`${w} h-[24rem]`} dir="rtl" lang="ar" />
      </State>
    </>
  )
}
