import { createFileRoute } from "@tanstack/react-router"
import { SupportPage } from "@/features/support-access/support-page"

/** The control plane's support link (adr/0061 Ek "Destek erişimi"): open before a session exists. */
export const Route = createFileRoute("/support")({
  component: SupportPage,
})
