import { Outlet, createFileRoute } from "@tanstack/react-router"
import { ReauthHost } from "@/components/layout/reauth-host"
import { StaffGate } from "@/features/auth/pages/no-role-page"
import { SessionErrorBoundary } from "@/features/auth/pages/session-unavailable-page"
import { requireStaff } from "./-require-staff"

/**
 * Behind sign-in like the shell's pages, but the screen is the page's own:
 * no menu, no top bar (the theme editor, adr/0049).
 */
export const Route = createFileRoute("/_fullscreen")({
  beforeLoad: requireStaff,
  errorComponent: SessionErrorBoundary,
  component: () => (
    <StaffGate>
      <Outlet />
      <ReauthHost />
    </StaffGate>
  ),
})
