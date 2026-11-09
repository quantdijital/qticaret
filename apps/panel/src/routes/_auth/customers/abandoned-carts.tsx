import { createFileRoute } from "@tanstack/react-router"
import { AbandonedCartsPage } from "@/features/customers/pages/abandoned-carts-page"
import { abandonedCartSearchSchema } from "@/features/customers/search"

export const Route = createFileRoute("/_auth/customers/abandoned-carts")({
  validateSearch: abandonedCartSearchSchema,
  component: AbandonedCartsPage,
})
