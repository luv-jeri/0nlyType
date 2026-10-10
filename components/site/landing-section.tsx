// One pattern for every numbered section after the dial, after C's programme: a hairline, the number and name as
// corner labels in the margin with one note under them, then the title and the body on the stave. Every section
// keeps the same space above and below and the same gap from title to body (app/landing.css, ".sec").

type SecProps = {
  id: string
  /** Two digits, as the rail and the corner label show it: "02". */
  num: string
  name: string
  title: React.ReactNode
  note?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Sec({ id, num, name, title, note, className, children }: SecProps) {
  return (
    <section className={className ? `sec ${className}` : "sec"} aria-labelledby={id}>
      <div className="sec-margin margin">
        <p className="sec-num" aria-hidden="true">
          {num}
        </p>
        <p className="sec-name">{name}</p>
        {note ? <p className="sec-note">{note}</p> : null}
      </div>
      <div className="stave">
        <h2 className="sec-title" id={id} data-rail={name} data-rail-num={num}>
          {title}
        </h2>
        <div className="sec-body">{children}</div>
      </div>
    </section>
  )
}
