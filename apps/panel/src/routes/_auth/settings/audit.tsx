import { createFileRoute } from "@tanstack/react-router"
import { auditSearchSchema } from "@/features/settings/api/audit"
import { AuditPage } from "@/features/settings/pages/audit-page"

export const Route = createFileRoute("/_auth/settings/audit")({
  validateSearch: auditSearchSchema,
  component: AuditPage,
})
