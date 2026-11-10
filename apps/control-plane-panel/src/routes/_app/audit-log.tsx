import { createFileRoute } from "@tanstack/react-router"
import { AuditPage } from "@/features/audit/pages/audit-page"
import { requireOwner } from "../-require-member"

/** The audit log: the owner's alone (adr/0061 Ek C4). */
export const Route = createFileRoute("/_app/audit-log")({
  beforeLoad: ({ context }) => {
    requireOwner(context.me)
  },
  component: AuditPage,
})
