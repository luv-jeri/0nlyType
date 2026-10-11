import { Sec } from "@/components/site/landing-section"

// 02, what the library leaves out (INTENT.md, "What it refuses"), each struck as it scrolls into view.
const LEFT_OUT = ["Pictures", "boxes", "cards", "shadows", "gradients", "icons drawn as pictures"]

export function Leaves() {
  return (
    <Sec
      id="leaves"
      num="02"
      name="What it leaves out"
      className="sec-leaves"
      title="What it leaves out."
      note="Each of these does a job that type can do on its own. So each one goes, on purpose."
    >
      <p className="leaves-list">
        {LEFT_OUT.map((w, i) => (
          <span key={w} className="leaves-word">
            <s className="leaves-strike" style={{ "--i": i } as React.CSSProperties}>
              {w}
            </s>
            {i < LEFT_OUT.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>
      <p className="leaves-kept">
        Kept: <span className="leaves-k">words</span>, <span className="leaves-k">space</span> and <span className="leaves-k">one accent</span>.
      </p>
      <p className="leaves-sign">An icon stays only as a sign made of its own word.</p>
    </Sec>
  )
}
