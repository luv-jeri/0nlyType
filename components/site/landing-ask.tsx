import { registryURL } from "@/lib/site/config.mjs"
import NextLink from "next/link"

import { AskFor } from "@/components/site/landing-ask-for"
import { Sec } from "@/components/site/landing-section"
import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { Link } from "@/registry/0nlytype/ui/link"

// 05, your words become the page: the kit that teaches your AI, then the sentence you finish, and the page you asked
// for sketched in your own words beside it.
export function Ask() {
  return (
    <Sec id="ask" num="05" name="Ask" title="Or ask for it." note="The AI kit puts 0nlyType’s rules and every contract in your project, so your assistant builds in type too.">
      <ol className="ask-steps">
        <li>
          <p className="ask-step">Add the kit.</p>
          <CommandLine runner command={`shadcn@latest add ${registryURL("ai")}`} emphasis="ai" className="ask-cmd" />
        </li>
        <li>
          <p className="ask-step">Say what you want.</p>
          <AskFor />
        </li>
      </ol>
      <p className="ask-links">
        <Link asChild>
          <NextLink href="/docs/build-with-ai/">Build with AI</NextLink>
        </Link>
      </p>
    </Sec>
  )
}
