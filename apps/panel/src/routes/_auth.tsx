import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { AppShell } from "@/components/layout/app-shell"
import { currentUserQuery } from "@/features/auth/api/me"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { applyAppearance, rememberAppearance } from "@/theme"

/** Everything behind sign-in: the shell, the user, and the shop's colours. */
export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(currentUserQuery()).catch(() => null)
    if (!user) {
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
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
