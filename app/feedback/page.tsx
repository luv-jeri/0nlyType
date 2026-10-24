import type { Metadata } from "next"

import { pageMeta } from "@/lib/site/meta"
import { FeedbackForms } from "@/components/site/reporting/forms"
import { entries } from "@/lib/site/entries"

export const metadata: Metadata = pageMeta({
  title: "Feedback",
  description: "Report an issue or request a component for 0nlyType.",
})

export default function FeedbackPage() {
  const components = entries.map(({ meta }) => ({ name: meta.name, title: meta.title, description: meta.summary, contract: meta.contract }))
  return <FeedbackForms entries={components} />
}
