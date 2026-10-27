import { createFileRoute } from "@tanstack/react-router"
import { ShippingPage } from "@/features/settings/pages/shipping-page"

export const Route = createFileRoute("/_auth/settings/shipping/")({
  component: ShippingPage,
})
