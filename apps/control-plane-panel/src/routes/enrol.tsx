import { createFileRoute } from "@tanstack/react-router"
import { EnrolLinkPage } from "@/features/enrol/pages/enrol-link-page"

/** An enrolment link after an owner's 2FA reset (`/enrol#token=…`, adr/0061 Ek C4, M3). */
export const Route = createFileRoute("/enrol")({
  component: EnrolLinkPage,
})
