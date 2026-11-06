import { createFileRoute } from "@tanstack/react-router"
import { ConfirmEmailPage } from "@/features/auth/pages/confirm-email-page"

/** A new sign-in address's link (the owner, 2026-11-06): open with or without a session. */
export const Route = createFileRoute("/confirm-email")({
  component: ConfirmEmailPage,
})
