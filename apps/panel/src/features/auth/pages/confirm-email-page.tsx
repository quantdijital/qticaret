import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { confirmEmailChange } from "@/features/settings/api/account"
import { linkParams } from "@/lib/link-params"

// What the API's keys mean on this page; anything else reads as the generic line
const FAILURES: Record<string, string> = {
  "staff.email_change_invalid": "confirmEmail.invalid",
  "staff.email_unavailable": "confirmEmail.unavailable",
  "errors.too_many_requests": "confirmEmail.tooMany",
}

const failureKey = (error: unknown): string => {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  const key = typeof code === "string" ? code : typeof message === "string" ? message : ""
  return FAILURES[key] ?? "errors.generic"
}

/**
 * The page a new sign-in address's e-mail opens (the owner, 2026-11-06).
 * It asks for a click rather than confirming on load: a mail scanner that
 * opens links must not use the link up. After it, the panel is signed into
 * with the new address.
 */
export function ConfirmEmailPage() {
  const { t } = useTranslation()
  const client = useQueryClient()
  // From the link's fragment: no server log saw it
  const [token] = useState(() => linkParams().get("token"))
  const confirm = useMutation({
    mutationFn: confirmEmailChange,
    onSuccess: () => client.invalidateQueries({ queryKey: ["auth"] }),
  })

  if (!token) {
    return (
      <AuthShell>
        <div role="alert">
          <AuthHeading
            title={t("confirmEmail.invalidTitle")}
            subtitle={t("confirmEmail.invalid")}
          />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      {confirm.isSuccess ? (
        <>
          <AuthHeading title={t("confirmEmail.doneTitle")} subtitle={t("confirmEmail.done")} />
          <Button asChild className="mt-8 w-full">
            <Link to="/">{t("confirmEmail.toPanel")}</Link>
          </Button>
        </>
      ) : (
        <>
          <AuthHeading title={t("confirmEmail.title")} subtitle={t("confirmEmail.subtitle")} />
          {confirm.isError ? (
            <p role="alert" className="mt-6 text-sm text-destructive-text">
              {t(failureKey(confirm.error))}
            </p>
          ) : null}
          <Button
            className="mt-8 w-full"
            disabled={confirm.isPending}
            onClick={() => {
              confirm.mutate(token)
            }}
          >
            {confirm.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("confirmEmail.confirm")}
          </Button>
        </>
      )}
    </AuthShell>
  )
}
