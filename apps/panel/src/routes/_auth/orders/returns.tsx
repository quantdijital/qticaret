import { createFileRoute } from "@tanstack/react-router"
import { ReturnsPage } from "@/features/orders/pages/returns-page"
import { returnSearchSchema } from "@/features/orders/return-search"

export const Route = createFileRoute("/_auth/orders/returns")({
  validateSearch: returnSearchSchema,
  component: ReturnsPage,
})
