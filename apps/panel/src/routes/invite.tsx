import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { InvitePage } from "@/features/auth/pages/invite-page"

const searchSchema = z.object({
  token: z.string().min(16).max(4096).optional().catch(undefined),
})

/** An invitation's link (F12.6): open before an account exists. */
export const Route = createFileRoute("/invite")({
  validateSearch: searchSchema,
  component: InvitePage,
})
