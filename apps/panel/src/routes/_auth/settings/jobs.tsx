import { createFileRoute } from "@tanstack/react-router"
import { JobsPage } from "@/features/settings/pages/jobs-page"

export const Route = createFileRoute("/_auth/settings/jobs")({
  component: JobsPage,
})
