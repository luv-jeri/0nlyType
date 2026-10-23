// One pattern for every numbered section after the dial, after C's programme: a hairline, the number and name as
// corner labels in the margin with one note under them, then the title and the body on the stave. On a phone it
// reads as one column: the labels, the title, the note as its lede, then the body. Every section
// keeps the same space above and below and the same gap from title to body (app/landing.css, ".sec"). A section whose
// picture wants the whole width (the sea) puts it in `wide`, a row under the title on the page's full grid.

type SecProps = {
  id: string
  /** Two digits, as the rail and the corner label show it: "02". */
  num: string
  name: string
  title: React.ReactNode
  note?: React.ReactNode
  className?: string
  children?: React.ReactNode
  /** A row under the title that spans the page's twelve columns, at the same gap as the body. */
  wide?: React.ReactNode
  /** False keeps the title in the page as you read on: its head never takes the bar (components/site/landing-pin.tsx). */
  pin?: boolean
}

export function Sec({ id, num, name, title, note, className, children, wide, pin = true }: SecProps) {
  return (
    <section className={className ? `sec ${className}` : "sec"} aria-labelledby={id} data-pin={pin ? undefined : "off"}>
      <div className="sec-margin margin">
        <div className="sec-label">
          <p className="sec-num" aria-hidden="true">
            {num}
          </p>
          <p className="sec-name">{name}</p>
        </div>
        {note ? <p className="sec-note">{note}</p> : null}
      </div>
      <div className="stave">
        <h2 className="sec-title" id={id} data-rail={name} data-rail-num={num}>
          {title}
        </h2>
        {children ? <div className="sec-body">{children}</div> : null}
      </div>
      {wide ? <div className="sec-wide">{wide}</div> : null}
    </section>
  )
}
