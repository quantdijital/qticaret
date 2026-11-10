import { Outlet, createFileRoute } from "@tanstack/react-router"
import { AppShell } from "@/components/layout/app-shell"
import { requireMember } from "./-require-member"

/** Everything behind sign-in and 2FA: the "Üst panel" bar, the menu, the page. */
export const Route = createFileRoute("/_app")({
  beforeLoad: requireMember,
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
