import { createFileRoute } from "@tanstack/react-router"
import { AuditPage } from "@/features/settings/pages/audit-page"

export const Route = createFileRoute("/_auth/settings/audit")({
  component: AuditPage,
})
