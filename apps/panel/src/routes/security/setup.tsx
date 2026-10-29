import { createFileRoute, redirect } from "@tanstack/react-router"
import { currentUserQuery } from "@/features/auth/api/me"
import { staffQuery } from "@/features/auth/api/staff"
import { MfaSetupPage } from "@/features/security/pages/mfa-setup-page"

/** 2FA setup, outside the shell: signed in, a role, and no factor yet (adr/0040 §2). */
export const Route = createFileRoute("/security/setup")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(currentUserQuery()).catch(() => null)
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
    const staff = await context.queryClient.query(staffQuery()).catch(() => null)
    if (!staff?.role || staff.mfa.enabled) {
      throw redirect({ to: "/" })
    }
  },
  component: MfaSetupPage,
})
