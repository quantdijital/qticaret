import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useLogout } from "@/features/auth/api/me"
import { useStaff } from "@/features/auth/api/staff"

/** A signed-in user without a role (taken off the team, or never given one): nothing to show. */
function NoRolePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout(() => void navigate({ to: "/login" }))
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div role="alert" className="w-full max-w-sm rounded-lg border bg-card p-6">
        <h1 className="text-lg font-semibold">{t("staff.noRole.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("staff.noRole.text")}</p>
        <Button
          className="mt-6 w-full"
          variant="outline"
          onClick={() => {
            logout.mutate()
          }}
        >
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  )
}

/** The panel only for staff with a role; the API refuses the others anyway (adr/0040). */
export function StaffGate({ children }: { children: ReactNode }) {
  const staff = useStaff()
  return staff?.role === null ? <NoRolePage /> : children
}
