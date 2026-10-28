import { createFileRoute, redirect } from "@tanstack/react-router"
import { SmsProviderPage } from "@/features/settings/pages/sms-provider-page"
import { isSmsProvider } from "@/features/settings/sms-providers"

export const Route = createFileRoute("/_auth/settings/sms/$provider")({
  // A service still being built, or a mistyped address, opens the list
  beforeLoad: ({ params }) => {
    if (!isSmsProvider(params.provider)) {
      throw redirect({ to: "/settings/sms" })
    }
  },
  component: SmsProviderPage,
})
