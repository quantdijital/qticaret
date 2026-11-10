import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { currentUserQuery } from "@/features/auth/api/me"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { confirmEmailChange } from "@/features/settings/api/account"
import { linkParams } from "@/lib/link-params"

// What the API's keys mean on this page; anything else reads as the generic line
const FAILURES: Record<string, string> = {
  "staff.email_change_invalid": "confirmEmail.invalid",
  "staff.email_unavailable": "confirmEmail.unavailable",
  "errors.too_many_requests": "confirmEmail.tooMany",
}

// The link waits here while its member signs in: this tab only, gone once used
const KEPT = "qt.confirm-email"

const failureKey = (error: unknown): string => {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  const key = typeof code === "string" ? code : typeof message === "string" ? message : ""
  return FAILURES[key] ?? "errors.generic"
}

function kept(): string | null {
  try {
    return window.sessionStorage.getItem(KEPT)
  } catch {
    return null
  }
}

function keep(token: string | null) {
  try {
    if (token) {
      window.sessionStorage.setItem(KEPT, token)
    } else {
      window.sessionStorage.removeItem(KEPT)
    }
  } catch {
    // Without storage the link is opened again after signing in
  }
}

/**
 * The page a new sign-in address's e-mail opens (the owner, 2026-11-06;
 * security review 2026-11-06). Only the member who asked, signed in,
 * confirms it: without a session the page sends them to sign in and back,
 * the link kept for this tab meanwhile. It asks for a click rather than
 * confirming on load: a mail scanner that opens links must not use it up.
 */
export function ConfirmEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  // From the link's fragment (no server log saw it), or kept across the sign-in
  const [token] = useState(() => linkParams().get("token") ?? kept())
  const user = useQuery({ ...currentUserQuery(), retry: false })
  const confirm = useMutation({
    mutationFn: confirmEmailChange,
    onSuccess: () => client.invalidateQueries({ queryKey: ["auth"] }),
    onSettled: () => {
      keep(null)
    },
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

  if (user.isPending) {
    return (
      <AuthShell>
        <LoadingRows rows={3} />
      </AuthShell>
    )
  }

  if (!user.data) {
    return (
      <AuthShell>
        <AuthHeading title={t("confirmEmail.title")} subtitle={t("confirmEmail.signInFirst")} />
        <Button
          className="mt-8 w-full"
          onClick={() => {
            keep(token)
            void navigate({ to: "/login", search: { redirect: "/confirm-email" } })
          }}
        >
          {t("confirmEmail.signIn")}
        </Button>
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
          <AuthHeading
            title={t("confirmEmail.title")}
            subtitle={t("confirmEmail.subtitleAs", { email: user.data.email })}
          />
          {confirm.isError ? (
            <p role="alert" className="mt-6 text-sm text-destructive-text">
              {t(failureKey(confirm.error))}
            </p>
          ) : null}
          <Button
            className="mt-8 w-full"
            disabled={confirm.isPending || confirm.isError}
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
