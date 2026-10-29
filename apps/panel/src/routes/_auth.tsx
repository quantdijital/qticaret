import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { AppShell } from "@/components/layout/app-shell"
import { currentUserQuery } from "@/features/auth/api/me"
import { staffQuery } from "@/features/auth/api/staff"
import { StaffGate } from "@/features/auth/pages/no-role-page"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { sdk } from "@/lib/sdk"
import { applyAppearance, rememberAppearance } from "@/theme"

/** Everything behind sign-in: the shell, the user, and the shop's colours. */
export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(currentUserQuery()).catch(() => null)
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
    // 2FA first (adr/0040 §2): no factor, its setup; a factor this session
    // has not passed (signed in before it was set up), a new sign-in
    const staff = await context.queryClient.query(staffQuery()).catch(() => null)
    if (staff?.role && staff.mfa.required && !staff.mfa.passed) {
      if (!staff.mfa.enabled) {
        throw redirect({ to: "/security/setup" })
      }
      await sdk.auth.logout().catch(() => undefined)
      context.queryClient.clear()
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
    // The remembered colours painted the first frame; the stored ones win
    const appearance = await context.queryClient
      .query({ ...appearanceQuery(), staleTime: "static" })
      .catch(() => null)
    if (appearance) {
      applyAppearance(appearance.values)
      rememberAppearance(appearance.values)
    }
    return { user }
  },
  component: () => (
    <StaffGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </StaffGate>
  ),
})
