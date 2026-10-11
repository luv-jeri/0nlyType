import { registryURL } from "@/lib/site/config.mjs"
import NextLink from "next/link"

import { AskFor } from "@/components/site/landing"
import { Sec } from "@/components/site/landing-section"
import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { Link } from "@/registry/0nlytype/ui/link"

// 05, the kit that teaches your AI, and the sentence you finish.
export function Ask() {
  return (
    <Sec id="ask" num="05" name="Ask" title="Or ask for it." note="The AI kit puts 0nlyType’s rules and every contract in your project, so your assistant builds in type too.">
      <ol className="ask-steps">
        <li>
          <p className="ask-step">Add the kit.</p>
          <CommandLine runner command={`shadcn@latest add ${registryURL("ai")}`} emphasis="ai" className="install-line" />
        </li>
        <li>
          <p className="ask-step">Say what you want.</p>
          <AskFor />
        </li>
      </ol>
      <p className="install-links">
        <Link asChild>
          <NextLink href="/docs/build-with-ai/">Build with AI</NextLink>
        </Link>
      </p>
    </Sec>
  )
}
