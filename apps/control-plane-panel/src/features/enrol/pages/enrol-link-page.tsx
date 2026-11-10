import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { meQuery } from "@/features/auth/api"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { holdEnrolmentToken, takeLinkToken } from "@/lib/link-token"
import { standingOf } from "@/features/auth/standing"

/**
 * The enrolment link an owner's 2FA reset sends (`/enrol#token=…`, adr/0061
 * Ek C4, M3). The reset ended the member's sessions: the token is held in
 * memory while they sign in with their password, then the setup takes it.
 */
export function EnrolLinkPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [token] = useState(takeLinkToken)
  const me = useQuery({ ...meQuery(), enabled: token !== null })
  useEffect(() => {
    if (token === null || me.isPending) {
      return
    }
    holdEnrolmentToken(token)
    if (me.isError) {
      void navigate({ to: "/login", search: { redirect: "/security/setup" } })
    } else {
      void navigate({ to: standingOf(me.data) === "through" ? "/" : "/security/setup" })
    }
  }, [token, me.isPending, me.isError, me.data, navigate])
  if (token === null) {
    return (
      <AuthShell>
        <div role="alert">
          <AuthHeading title={t("enrol.invalid.title")} subtitle={t("enrol.invalid.text")} />
        </div>
      </AuthShell>
    )
  }
  return (
    <AuthShell>
      <div aria-busy="true" className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    </AuthShell>
  )
}
