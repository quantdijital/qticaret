import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page"

const searchSchema = z.object({
  token: z.string().min(16).max(4096).optional().catch(undefined),
  email: z.string().max(254).optional().catch(undefined),
})

/** A forgotten password (F12.6): open without a session. */
export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})
