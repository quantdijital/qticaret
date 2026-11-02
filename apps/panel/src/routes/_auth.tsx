import { Outlet, createFileRoute } from "@tanstack/react-router"
import { AppShell } from "@/components/layout/app-shell"
import { StaffGate } from "@/features/auth/pages/no-role-page"
import { requireStaff } from "./-require-staff"

/** Everything behind sign-in: the shell, the user, and the shop's colours. */
export const Route = createFileRoute("/_auth")({
  beforeLoad: requireStaff,
  component: () => (
    <StaffGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </StaffGate>
  ),
})
