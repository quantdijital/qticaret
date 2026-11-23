import { createFileRoute } from "@tanstack/react-router"
import { AttributesPage } from "@/features/settings/pages/attributes-page"

export const Route = createFileRoute("/_auth/settings/attributes/")({
  component: AttributesPage,
})
