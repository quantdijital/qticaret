import { createFileRoute } from "@tanstack/react-router"
import { FeaturesPage } from "@/features/settings/pages/features-page"

export const Route = createFileRoute("/_auth/settings/features")({
  component: FeaturesPage,
})
