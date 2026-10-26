import { createFileRoute } from "@tanstack/react-router"
import { ContentEntryPage } from "@/features/content/pages/content-entry-page"

export const Route = createFileRoute("/_auth/content/$id")({
  component: ContentEntryPage,
})
