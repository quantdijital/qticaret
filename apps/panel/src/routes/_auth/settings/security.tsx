import { createFileRoute } from "@tanstack/react-router"
import { SecurityPage } from "@/features/settings/pages/security-page"

export const Route = createFileRoute("/_auth/settings/security")({
  component: SecurityPage,
})
