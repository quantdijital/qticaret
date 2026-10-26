import { createFileRoute } from "@tanstack/react-router"
import { LandingEntryPage } from "@/features/content/pages/landing-entry-page"

export const Route = createFileRoute("/_auth/content/landings/$id")({
  component: LandingEntryPage,
})
