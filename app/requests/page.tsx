import type { Metadata } from "next"

import { pageMeta } from "@/lib/site/meta"
import { RequestBoard } from "@/components/site/reporting/request-board"

export const metadata: Metadata = pageMeta({
  title: "Component requests",
  description: "Find a component request, join it, or suggest what 0nlyType should build next.",
})

export default function RequestsPage() {
  return <RequestBoard />
}
