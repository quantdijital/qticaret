import { createFileRoute } from "@tanstack/react-router"
import { AccountingPage } from "@/features/settings/pages/accounting-page"

export const Route = createFileRoute("/_auth/settings/accounting")({
  component: AccountingPage,
})
