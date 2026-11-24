import { createFileRoute } from "@tanstack/react-router"
import { PopupsPage } from "@/features/popups/pages/popups-page"
import { popupsSearchSchema } from "@/features/popups/search"

export const Route = createFileRoute("/_auth/popups/")({
  validateSearch: popupsSearchSchema,
  // `marketing.popups` off: the "kapalı" state, not the list (the records are kept)
  component: PopupsPage,
})
