import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { currentUserQuery } from "@/features/auth/api/me"
import { LoginPage } from "@/features/auth/pages/login-page"

// Where to go after signing in: only a path on this panel; anything else is dropped
const searchSchema = z.object({
  redirect: z.string().startsWith("/").optional().catch(undefined),
})

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.query(currentUserQuery()).catch(() => null)
    if (user) {
      throw redirect({ to: search.redirect ?? "/" })
    }
  },
  component: LoginPage,
})
