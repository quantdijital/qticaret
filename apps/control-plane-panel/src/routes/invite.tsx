import { createFileRoute } from "@tanstack/react-router"
import { InvitePage } from "@/features/invite/pages/invite-page"

/** An invitation's link (`/invite#token=…`): open before an account exists. */
export const Route = createFileRoute("/invite")({
  component: InvitePage,
})
