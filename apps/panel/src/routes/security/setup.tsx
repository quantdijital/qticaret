import { createFileRoute, redirect } from "@tanstack/react-router"
import { loadCurrentUser } from "@/features/auth/api/session"
import { staffQuery } from "@/features/auth/api/staff"
import { SessionErrorBoundary } from "@/features/auth/pages/session-unavailable-page"
import { MfaSetupPage } from "@/features/security/pages/mfa-setup-page"

/** 2FA setup, outside the shell: signed in, a role, and no factor yet (adr/0040 §2). */
export const Route = createFileRoute("/security/setup")({
  errorComponent: SessionErrorBoundary,
  beforeLoad: async ({ context, location }) => {
    const user = await loadCurrentUser(context.queryClient)
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
