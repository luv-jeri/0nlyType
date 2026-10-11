import NextLink from "next/link"

// The big call to action, used in the hero, in Help build it and in the coda.

/**
 * Light type on a hairline. Coming to it, the letters swell to heavy one after another, a crescendo read left to
 * right, and the accent full stop lands. The heaviest state is reserved, so nothing moves. `label` is the whole call
 * for a screen reader when the word shown is a part of it, as on the 06 poster ("Request" for "Request a component").
 */
export function Cta({ href, children, label, size, className }: { href: string; children: string; label?: string; size?: "l"; className?: string }) {
  return (
    <NextLink href={href} prefetch={false} className={className ? `cta ${className}` : "cta"} data-size={size}>
      <span className="ot-sr">{label ?? children}</span>
      <span className="cta-word" aria-hidden="true" data-text={children}>
        <span className="cta-letters">
          {Array.from(children).map((c, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties}>
              {c}
            </span>
          ))}
        </span>
      </span>
      <span className="cta-stop" aria-hidden="true">
        .
      </span>
    </NextLink>
  )
}
