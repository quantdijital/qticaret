import { createFileRoute } from "@tanstack/react-router"
import { TravelerRequestsPage } from "@/features/customers/pages/traveler-requests-page"

/** `/customers/travelers`: a traveler's own KVKK request (adr/0076 Ek D6b). */
export const Route = createFileRoute("/_auth/customers/travelers")({
  component: TravelerRequestsPage,
})
