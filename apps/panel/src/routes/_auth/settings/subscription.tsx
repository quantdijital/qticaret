import { createFileRoute } from "@tanstack/react-router"
import { SubscriptionPage } from "@/features/settings/pages/subscription-page"

// adr/0061 Ek C14: the package, limits and use, payment (read only)
export const Route = createFileRoute("/_auth/settings/subscription")({
  component: SubscriptionPage,
})
