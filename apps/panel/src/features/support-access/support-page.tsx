import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { linkParams } from "@/lib/link-params"
import { SupportFailure, redeemSupportGrant } from "./api"

const S = "supportAccess.page"

// What the API's keys mean here; anything else reads as the generic line
const FAILURES: Record<string, string> = {
  "support.grant_expired": `${S}.expired`,
  "support.grant_used": `${S}.used`,
  "support.disabled": `${S}.disabled`,
  "support.wrong_tenant": `${S}.invalid`,
  "support.grant_invalid": `${S}.invalid`,
  "signature.invalid": `${S}.invalid`,
  "signature.unknown_key": `${S}.invalid`,
  "signature.malformed": `${S}.invalid`,
}

/**
 * The link the control plane opens for its support staff (adr/0061 Ek
 * "Destek erişimi"): the grant after `#` (no server's log keeps it), read
 * once and taken out of the address bar, redeemed for a time-limited
 * session; then the panel's home.
 */
export function SupportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [grant] = useState(() => linkParams().get("grant"))
  const redeem = useMutation({
    mutationFn: redeemSupportGrant,
    onSuccess: async () => {
      // Whoever was signed in before is gone: the session was renewed
      client.clear()
      await navigate({ to: "/" })
    },
  })
  const { mutate } = redeem
  useEffect(() => {
    if (grant) {
      mutate(grant)
    }
  }, [grant, mutate])

  const failure = !grant
    ? `${S}.missing`
    : redeem.error
      ? (FAILURES[redeem.error instanceof SupportFailure ? (redeem.error.key ?? "") : ""] ??
        `${S}.failed`)
      : null

  return (
    <AuthShell>
      {failure ? (
        <div role="alert">
          <AuthHeading title={t(`${S}.failedTitle`)} subtitle={t(failure)} />
        </div>
      ) : (
        <>
          <AuthHeading title={t(`${S}.title`)} subtitle={t(`${S}.opening`)} />
          <LoadingRows />
        </>
      )}
    </AuthShell>
  )
}
