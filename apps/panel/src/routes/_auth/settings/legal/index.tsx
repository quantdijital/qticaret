import { createFileRoute } from "@tanstack/react-router"
import { LegalListPage } from "@/features/legal/pages/legal-list-page"

export const Route = createFileRoute("/_auth/settings/legal/")({
  component: LegalListPage,
})
