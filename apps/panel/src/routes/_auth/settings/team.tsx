import { createFileRoute } from "@tanstack/react-router"
import { TeamPage } from "@/features/settings/pages/team-page"

export const Route = createFileRoute("/_auth/settings/team")({
  component: TeamPage,
})
