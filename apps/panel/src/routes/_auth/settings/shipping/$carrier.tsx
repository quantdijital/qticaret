import { createFileRoute, redirect } from "@tanstack/react-router"
import { ShippingCarrierPage } from "@/features/settings/pages/shipping-carrier-page"
import { isCarrier } from "@/features/settings/shipping-carriers"

export const Route = createFileRoute("/_auth/settings/shipping/$carrier")({
  // A carrier still being built, or a mistyped address, opens the list
  beforeLoad: ({ params }) => {
    if (!isCarrier(params.carrier)) {
      throw redirect({ to: "/settings/shipping" })
    }
  },
  component: ShippingCarrierPage,
})
