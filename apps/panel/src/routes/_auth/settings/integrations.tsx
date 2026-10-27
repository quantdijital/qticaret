import { createFileRoute } from "@tanstack/react-router"
import { IntegrationsPage } from "@/features/settings/pages/integrations-page"

export const Route = createFileRoute("/_auth/settings/integrations")({
  component: IntegrationsPage,
})
