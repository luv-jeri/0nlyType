import { registryURL, sitePath } from "@/lib/site/config.mjs"
import type { Metadata } from "next"

import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { CopyButton } from "@/registry/0nlytype/ui/source"
import { Link } from "@/registry/0nlytype/ui/link"
import { Prose } from "@/registry/0nlytype/ui/typography"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/registry/0nlytype/ui/table"

export const metadata: Metadata = {
  title: "Build with AI",
  description: "Give your AI tool the 0nlyType rules, references and component contracts before it builds.",
}

const INSTALL = `npx shadcn@latest add ${registryURL("ai")}`

const FILES = [
  { paths: ["AGENTS.md"], reader: "Codex and compatible agents", purpose: "Short rules, reference pointers and a completion checklist." },
  { paths: ["docs/0nlytype/AGENTS.md"], reader: "Any tool, when asked", purpose: "A namespaced copy to reference from your existing project instructions." },
  { paths: ["docs/0nlytype/INTENT.md", "docs/0nlytype/DESIGN-core.md"], reader: "Any tool, when asked", purpose: "The intent, principles, conventions, tokens and general motion rules." },
  { paths: ["docs/0nlytype/DESIGN.md"], reader: "Any tool, as a reference", purpose: "The complete design system. Read the relevant sections as needed." },
  { paths: ["docs/0nlytype/components/<item>.md"], reader: "Any tool, for the task at hand", purpose: "The component contract, motion and design reference." },
  { paths: [".cursor/rules/0nlytype.mdc"], reader: "Cursor Agent", purpose: "Short rules, always applied." },
  { paths: [".claude/rules/0nlytype.md"], reader: "Claude Code", purpose: "A short entry point with references to read as needed." },
  { paths: [".github/instructions/0nlytype.instructions.md"], reader: "GitHub Copilot", purpose: "Rules for TSX and CSS files. Support varies by feature." },
  { paths: [".devin/rules/0nlytype.md"], reader: "Windsurf / Cascade", purpose: "Always-on rules. Older versions use .windsurf/rules/." },
  { paths: [".agents/skills/0nlytype-component/SKILL.md", ".claude/skills/0nlytype-component/SKILL.md"], reader: "Codex / Claude Code", purpose: "A workflow: inspect, choose a precedent, implement, verify." },
  { paths: ["docs/0nlytype/manifest.json"], reader: "You and your tool", purpose: "The kit version and hashes of its sources and contents." },
]

const PROMPTS = [
  {
    title: "Build a component",
    text: "Read docs/0nlytype/AGENTS.md, docs/0nlytype/INTENT.md, docs/0nlytype/DESIGN-core.md and the relevant component contracts. Confirm which paths you loaded. Build [component] for [behavior]. Use an installed 0nlyType component as precedent. Run the completion checklist and report evidence.",
  },
  {
    title: "Keep your project instructions",
    text: "Preserve my existing project instructions. Add a short 0nlyType section pointing to docs/0nlytype/AGENTS.md.",
  },
  {
    title: "Refresh the kit",
    text: "Refresh the 0nlyType AI kit. Preserve my existing project instructions and local changes. Compare the installed docs/0nlytype/manifest.json with the latest kit, review the differences and update the generated references. Confirm which paths you loaded and report what changed.",
  },
]

const DOWNLOADS = [
  { href: "/ai/AGENTS.md", title: "AGENTS.md", note: "The short rules and completion checklist." },
  { href: "/ai/INTENT.md", title: "INTENT.md", note: "What 0nlyType is for, and what it refuses." },
  { href: "/ai/DESIGN-core.md", title: "DESIGN-core.md", note: "Principles, conventions, tokens and motion." },
  { href: "/ai/DESIGN.md", title: "DESIGN.md", note: "The complete design reference." },
  { href: "/llms.txt", title: "llms.txt", note: "A small index for browsing assistants." },
]

export default function BuildWithAI() {
  return (
    <>
      <header className="doc-head">
        <h1 className="doc-title">Build with AI</h1>
        <p className="doc-summary">Give your tool the rules before it builds. The AI kit brings 0nlyType&apos;s intent, design system and component contracts into your project.</p>
      </header>
      <section className="doc-section doc-ai-install" aria-labelledby="install-h">
        <h2 id="install-h" data-rail="Install the kit">Install the kit</h2>
        <div className="doc-steps">
          <Prose>
            <p>Run this from an app that has already been initialized with shadcn.</p>
          </Prose>
          <CommandLine command={INSTALL} emphasis="ai" aria-label="Install the 0nlyType AI kit" />
          <Prose>
            <p>If you already have an AGENTS.md, keep it. The installer asks before replacing a file; it does not merge Markdown. Use the prompt below to add a pointer to <code dir="ltr">docs/0nlytype/AGENTS.md</code>.</p>
          </Prose>
        </div>
      </section>
      <section className="doc-section" aria-labelledby="files-h">
        <h2 id="files-h" data-rail="Files and tools">Files and tools</h2>
        <p className="doc-lead">Short instructions are discovered by your tool. The complete references stay available for the task at hand. Ask the tool to confirm what it loaded.</p>
        <Table className="doc-ai-files">
          <TableCaption>The AI kit files, their readers and their purpose</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Read by</TableHead>
              <TableHead>What it is for</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FILES.map((file) => (
              <TableRow key={file.paths[0]}>
                <TableHead scope="row">{file.paths.map((path) => <code key={path} dir="ltr">{path}</code>)}</TableHead>
                <TableCell>{file.reader}</TableCell>
                <TableCell>{file.purpose}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="doc-section" aria-labelledby="prompts-h">
        <h2 id="prompts-h" data-rail="Prompts">Prompts</h2>
        <div className="doc-steps">
          {PROMPTS.map((prompt, i) => (
            <section key={prompt.title} aria-labelledby={`prompt-${i}`}>
              <div className="doc-ai-prompt-head">
                <h3 id={`prompt-${i}`} className="doc-sub">{prompt.title}</h3>
                <CopyButton text={prompt.text} aria-label={`Copy prompt: ${prompt.title}`} />
              </div>
              <Prose className="doc-ai-prompt">
                <blockquote><p dir="ltr">{prompt.text.split("/").flatMap((part, i) => (i ? [<wbr key={i} />, "/" + part] : [part]))}</p></blockquote>
              </Prose>
            </section>
          ))}
        </div>
      </section>
      <section className="doc-section" aria-labelledby="refresh-h">
        <h2 id="refresh-h" data-rail="Keep it current">Keep it current</h2>
        <Prose>
          <p>The installed files are copies. To refresh them, run the install command again and review the changes before replacing files. Keep your project instructions and local edits.</p>
          <p><code dir="ltr">docs/0nlytype/manifest.json</code> records the kit version and source hashes. Ask your tool to compare it and reload the updated references.</p>
        </Prose>
      </section>
      <section className="doc-section" aria-labelledby="downloads-h">
        <h2 id="downloads-h" data-rail="Downloads">Downloads</h2>
        <Prose>
          <p>For tools that read URLs or attachments, download the references or give the tool their links.</p>
          <ul>
            {DOWNLOADS.map((file) => (
              <li key={file.href}><Link href={sitePath(file.href)} download><bdi dir="ltr">{file.title}</bdi></Link> — {file.note}</li>
            ))}
          </ul>
          <p>A file being available does not mean a tool has read it. Ask it to confirm the loaded paths before it starts.</p>
        </Prose>
      </section>
    </>
  )
}
