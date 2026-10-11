import { Calligram } from "@/registry/0nlytype/ui/calligram"
import { State } from "@/components/site/state"

const text =
  "Everything is type. A heading is type, and so is a button, a rule, a sign on a door, and nothing in the interface is a picture of something else. A page like this has a pulse in it, a breath, a line turning three words along. Type is a place you can stand and read, and this is the shape it leaves when it is set down in words."

const short = "Everything is type. A heading is type, a button is type, and nothing here is a picture of something else."

const rain = "It is raining letters, a soft fall under everything, and a line breaks three words along, and nobody in the room looks up"

const frame = "Held in this frame the room goes quiet, the street and the voices and the hum fall away one by one, and what is left in the middle is the one thing you came here to do"

export default function Example() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] justify-items-center gap-16">
      <Calligram fade>{text}</Calligram>
      <div className="grid w-full max-w-[44rem] grid-cols-[minmax(0,1fr)] items-start gap-12 sm:grid-cols-2">
        <Calligram variant="rain" fade size="20rem" className="mx-auto">{rain}</Calligram>
        <Calligram variant="mirror" centre="listen" size="20rem" className="mx-auto">{frame}</Calligram>
      </div>
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="Circle"><Calligram size="20rem">{text}</Calligram></State>
      <State label="Fermata"><Calligram shape="fermata" size="20rem">{short}</Calligram></State>
      <State label="Wave"><Calligram shape="wave" size="20rem">{text}</Calligram></State>
      <State label="Rain"><Calligram variant="rain" size="20rem">{rain}</Calligram></State>
      <State label="Mirror"><Calligram variant="mirror" centre="listen" size="20rem">{frame}</Calligram></State>
    </>
  )
}
