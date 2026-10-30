import { createFileRoute } from "@tanstack/react-router"
import { EinvoicePage } from "@/features/settings/pages/einvoice-page"

export const Route = createFileRoute("/_auth/settings/einvoice")({
  component: EinvoicePage,
})
