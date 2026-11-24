import { createFileRoute } from "@tanstack/react-router"
import { NewPopupPage } from "@/features/popups/pages/new-popup-page"
import { newPopupSearchSchema } from "@/features/popups/search"

export const Route = createFileRoute("/_auth/popups/new")({
  validateSearch: newPopupSearchSchema,
  component: NewPopupPage,
})
