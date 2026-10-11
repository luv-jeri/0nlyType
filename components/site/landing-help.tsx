import { Cta } from "@/components/site/landing-hero"
import { Sec } from "@/components/site/landing-section"
import { REPO, ShareCall } from "@/components/site/landing-share"

// 06, how to help build it.
export function Help() {
  return (
    <Sec
      id="help"
      num="06"
      name="Help"
      title="Help build it."
      note="0nlyType is made by a small team, in the open. You don’t need to write code to shape what it becomes."
    >
      <ul className="help-list">
        <li>
          <Cta href="/requests/">Request a component</Cta>
          <p className="help-note">The piece you need and can&rsquo;t find. The most asked for are built first.</p>
        </li>
        <li>
          <Cta href="/feedback/?kind=bug">Report a bug</Cta>
          <p className="help-note">Something that breaks, reads wrong, or moves when it shouldn&rsquo;t.</p>
        </li>
        <li>
          <Cta href={REPO}>Star it on GitHub</Cta>
          <p className="help-note">We need your support to keep working on this. A star is how we know it&rsquo;s wanted.</p>
        </li>
        <li>
          <ShareCall url="/" text="0nlyType: React components, set in type" note="Send it to someone who builds interfaces. It’s how a small library gets found.">
            Share it
          </ShareCall>
        </li>
      </ul>
    </Sec>
  )
}
