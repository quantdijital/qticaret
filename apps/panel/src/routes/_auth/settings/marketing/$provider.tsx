import { createFileRoute, redirect } from "@tanstack/react-router"
import { isConversionProvider } from "@/features/settings/conversion-providers"
import { ConversionProviderPage } from "@/features/settings/pages/conversion-provider-page"

export const Route = createFileRoute("/_auth/settings/marketing/$provider")({
  // A service still being built, or a mistyped address, opens the marketing page
  beforeLoad: ({ params }) => {
    if (!isConversionProvider(params.provider)) {
      throw redirect({ to: "/settings/marketing" })
    }
  },
  component: ConversionProviderPage,
})
