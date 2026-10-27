import { createFileRoute, redirect } from "@tanstack/react-router"
import { isConnectable } from "@/features/settings/payment-methods"
import { PaymentProviderPage } from "@/features/settings/pages/payment-provider-page"

export const Route = createFileRoute("/_auth/settings/payments/$provider")({
  // A method still being built, or a mistyped address, opens the list
  beforeLoad: ({ params }) => {
    if (!isConnectable(params.provider)) {
      throw redirect({ to: "/settings/payments" })
    }
  },
  component: PaymentProviderPage,
})
