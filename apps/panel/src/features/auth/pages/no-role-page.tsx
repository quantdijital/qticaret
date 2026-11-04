import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useLogout } from "@/features/auth/api/me"
import { useStaff } from "@/features/auth/api/staff"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"

/** A signed-in user without a role (taken off the team, or never given one): nothing to show. */
function NoRolePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout(() => void navigate({ to: "/login" }))
  return (
    <AuthShell>
      <div role="alert">
        <AuthHeading title={t("staff.noRole.title")} subtitle={t("staff.noRole.text")} />
      </div>
      <Button
        className="mt-8 w-full"
        variant="outline"
        onClick={() => {
          logout.mutate()
        }}
      >
        {t("nav.logout")}
      </Button>
    </AuthShell>
  )
}

/** The panel only for staff with a role; the API refuses the others anyway (adr/0040). */
export function StaffGate({ children }: { children: ReactNode }) {
  const staff = useStaff()
  return staff?.role === null ? <NoRolePage /> : children
}
