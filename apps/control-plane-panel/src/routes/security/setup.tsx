import { createFileRoute, redirect } from "@tanstack/react-router"
import { signOut } from "@/features/auth/api"
import { EnrolPage } from "@/features/enrol/pages/enrol-page"
import { standingOf } from "@/features/auth/standing"
import { loadMe } from "../-require-member"

/** 2FA setup, outside the shell: signed in, and a factor still to set up. */
export const Route = createFileRoute("/security/setup")({
  beforeLoad: async ({ context, location }) => {
    const me = await loadMe(context.queryClient, location.href)
    const standing = standingOf(me)
    if (standing === "through") {
      throw redirect({ to: "/" })
    }
    if (standing === "sign-in-again") {
      await signOut(() => {
        context.queryClient.clear()
      })
      throw redirect({ to: "/login" })
    }
  },
  component: EnrolPage,
})
