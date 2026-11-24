import { createFileRoute } from "@tanstack/react-router"
import { PopupPage } from "@/features/popups/pages/popup-page"

export const Route = createFileRoute("/_auth/popups/$id")({
  component: PopupPage,
})
