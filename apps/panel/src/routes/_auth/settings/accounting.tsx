import { createFileRoute, redirect } from "@tanstack/react-router"

// Accounting lives on the invoices page now (the owner, 2026-10-31): old links land on its tab
export const Route = createFileRoute("/_auth/settings/accounting")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/einvoice", search: { part: "accounting" } })
  },
})
