import { createFileRoute } from "@tanstack/react-router"
import { TierPage } from "@/features/wholesale/pages/tier-page"

export const Route = createFileRoute("/_auth/customers/wholesale/tiers/$id")({
  component: TierPage,
})
