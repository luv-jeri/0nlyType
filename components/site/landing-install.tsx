import { registryURL } from "@/lib/site/config.mjs"
import NextLink from "next/link"

import { Sec } from "@/components/site/landing-section"
import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { Link } from "@/registry/0nlytype/ui/link"

// 04, the line that installs it.
export function Install() {
  return (
    <Sec
      id="install"
      num="04"
      name="Install"
      title="One line."
      note="0nlyType is a shadcn registry. Each piece arrives as source in your project, with its styles and the tokens it stands on."
    >
      <CommandLine runner command={`shadcn@latest add ${registryURL("button")}`} emphasis="button" className="install-line" />
      <p className="install-then">Nothing to update. Nothing to wrap. It&rsquo;s yours now.</p>
      <p className="install-links">
        <Link asChild>
          <NextLink href="/docs/install/">Set up a project</NextLink>
        </Link>
      </p>
    </Sec>
  )
}
