import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { meQuery } from "@/features/auth/api"
import { SignInPage } from "@/features/auth/pages/sign-in-page"

// Where to go after signing in: only a path on this panel; `//host` and `/\host` are other sites
const searchSchema = z.object({
  redirect: z
    .string()
    .regex(/^\/(?![/\\])/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    // Signed in already: on to where they were going (the guard leads a setup on)
    const me = await context.queryClient.query(meQuery()).catch(() => null)
    if (me) {
      throw redirect({ to: search.redirect ?? "/" })
    }
  },
  component: SignInPage,
})
