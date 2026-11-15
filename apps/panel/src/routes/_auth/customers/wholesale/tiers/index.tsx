import { createFileRoute } from "@tanstack/react-router"
import { TiersPage } from "@/features/wholesale/pages/tiers-page"
import { tierListSearchSchema } from "@/features/wholesale/search"

export const Route = createFileRoute("/_auth/customers/wholesale/tiers/")({
  validateSearch: tierListSearchSchema,
  component: TiersPage,
})
