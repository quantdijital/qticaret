import { createFileRoute, redirect } from "@tanstack/react-router"
import { loadCurrentUser, loadStaff } from "@/features/auth/api/session"
import { SessionErrorBoundary } from "@/features/auth/pages/session-unavailable-page"
import { MfaSetupPage } from "@/features/security/pages/mfa-setup-page"

/** 2FA setup, outside the shell: signed in, a role, and no factor yet (adr/0040 §2). */
export const Route = createFileRoute("/security/setup")({
  errorComponent: SessionErrorBoundary,
  beforeLoad: async ({ context, location }) => {
    const user = await loadCurrentUser(context.queryClient)
    const staff = user ? await loadStaff(context.queryClient) : null
    if (!user || !staff) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
    if (!staff.role || staff.mfa.enabled) {
      throw redirect({ to: "/" })
    }
  },
  component: MfaSetupPage,
})
