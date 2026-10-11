import { Cta } from "@/components/site/landing-hero"
import { Sec } from "@/components/site/landing-section"
import { ShareCall } from "@/components/site/landing-share"
import { REPO } from "@/lib/site/meta"

// 06, how to help build it: a type poster made of the four calls. "Request", "Report", "Star" and "Share" are set
// large, heavy and condensed, stacked tight, one running up the margin and one leaning a few degrees, and each is
// crossed by its reason in a light italic, the way "has" crosses "It" on the "It has to be design." poster. Over
// each word a dimension line measures it, Paul Rand's way, and its label finishes the call ("a component", "a bug");
// a callout string hangs the small print under it. The words are the real links and the share button, so focus,
// hover and the share panel all work as they do elsewhere; pointing at one lights its dimension line and its note.
// At rest one Weingart highlight, in the accent, marks why a star matters; the moment you point at a call, it gives
// the accent to that call's full stop, so there is never more than one. The scroll sets the poster: each word slides
// in from its own side and angle and is set the moment it is wholly on the screen (app/landing-help.css). Without
// scroll timelines, or with reduced motion, the poster is simply set.

export function Help() {
  return (
    <Sec
      id="help"
      num="06"
      name="Help"
      title="Help build it."
      note="0nlyType is made by a small team, in the open. You don’t need to write code to shape what it becomes."
      className="help"
      wide={
        <ul className="help-poster">
          <li className="help-call" data-call="request">
            <Cta href="/requests/" label="Request a component">Request</Cta>
            <p className="help-dim">a component</p>
            <p className="help-cross">what you can&rsquo;t find</p>
            <p className="help-why">The piece you need and can&rsquo;t find. The most asked for are built first.</p>
          </li>
          <li className="help-call" data-call="report">
            <Cta href="/feedback/?kind=bug" label="Report a bug">Report</Cta>
            <p className="help-dim">a bug</p>
            <p className="help-cross">what breaks</p>
            <p className="help-why">Something that breaks, reads wrong, or moves when it shouldn&rsquo;t.</p>
          </li>
          <li className="help-call" data-call="star">
            <Cta href={REPO} label="Star it on GitHub">Star</Cta>
            <p className="help-dim">it on GitHub ↗</p>
            <p className="help-cross">
              so we know it&rsquo;s <span className="help-hl">wanted</span>
            </p>
            <p className="help-why">We need your support to keep working on this. A star is how we know it&rsquo;s wanted.</p>
          </li>
          <li className="help-call" data-call="share">
            <ShareCall url="/" label="Share 0nlyType" text="0nlyType: React components, set in type" note="Send it to someone who builds interfaces. It’s how a small library gets found.">
              Share
            </ShareCall>
            <p className="help-dim">the link</p>
            <p className="help-cross">with someone who builds</p>
          </li>
        </ul>
      }
    />
  )
}
