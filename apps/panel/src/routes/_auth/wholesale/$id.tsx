import { createFileRoute } from "@tanstack/react-router"
import { WholesalerPage } from "@/features/wholesale/pages/wholesaler-page"

export const Route = createFileRoute("/_auth/wholesale/$id")({
  component: WholesalerPage,
})
