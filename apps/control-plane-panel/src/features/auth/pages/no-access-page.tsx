import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useSignOut } from "@/features/auth/api"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"

/**
 * Signed in, but no access (403 `cp.no_role`): deactivated, never given a
 * role, or a 2FA setup window that ran out (an owner resets it again).
 */
export function NoAccessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signOut = useSignOut(() => void navigate({ to: "/login" }))
  return (
    <AuthShell>
      <div role="alert">
        <AuthHeading title={t("noAccess.title")} subtitle={t("noAccess.text")} />
      </div>
      <Button
        className="mt-8 w-full"
        variant="outline"
        onClick={() => {
          signOut.mutate()
        }}
      >
        {t("nav.signOut")}
      </Button>
    </AuthShell>
  )
}
