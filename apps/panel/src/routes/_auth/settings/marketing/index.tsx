import { createFileRoute } from "@tanstack/react-router"
import { MarketingPage } from "@/features/settings/pages/marketing-page"

export const Route = createFileRoute("/_auth/settings/marketing/")({
  component: MarketingPage,
})
