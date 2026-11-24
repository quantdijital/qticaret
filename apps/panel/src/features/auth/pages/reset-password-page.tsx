import { useMutation } from "@tanstack/react-query"
import { Link, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { answerKey, isTurnstileRefusal, postGated } from "@/features/auth/api/gated-post"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { useStaffTurnstile } from "@/features/auth/components/staff-turnstile"
import { PasswordInput } from "@/features/auth/components/password-input"
import { passwordRuleText } from "@/features/auth/password-rule"
import { sdk } from "@/lib/sdk"
import { linkParams } from "@/lib/link-params"

// docs/04: length first, ten characters at least
const MIN_PASSWORD = 10

/** The address a reset link goes to; the same answer whether it has a login or not. */
function RequestForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  // Every request carries Turnstile's token (adr/0044 Ek 2026-11-24)
  const turnstile = useStaffTurnstile("staff_password_reset")
  const request = useMutation({
    mutationFn: async (identifier: string) => {
      const answer = await postGated(
        "/auth/user/emailpass/reset-password",
        { identifier },
        turnstile.gate
      )
      if (answer.status >= 400) {
        throw Object.assign(new Error(answer.body.message ?? ""), {
          status: answer.status,
          code: answerKey(answer.body),
        })
      }
    },
  })
  if (request.isSuccess) {
    return <p className="mt-8 text-sm">{t("reset.sent")}</p>
  }
  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        request.mutate(email.trim())
      }}
      onFocus={turnstile.warm}
      onPointerDown={turnstile.warm}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
          }}
        />
      </div>
      {turnstile.slot}
      {request.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t(isTurnstileRefusal(request.error) ? "login.turnstile.failed" : "errors.generic")}
        </p>
      ) : null}
      <Button type="submit" disabled={!/^[^\s@]+@[^\s@]+$/.test(email.trim()) || request.isPending}>
        {t("reset.send")}
      </Button>
    </form>
  )
}

/** A new password with the link's token, good for 15 minutes. */
function NewPasswordForm({ token }: { token: string }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const change = useMutation({
    mutationFn: (value: string) =>
      sdk.auth.updateProvider("user", "emailpass", { password: value }, token),
  })
  if (change.isSuccess) {
    return (
      <div className="mt-8 flex flex-col gap-5">
        <p className="text-sm">{t("reset.changed")}</p>
        <Button asChild>
          <Link to="/login">{t("reset.toLogin")}</Link>
        </Button>
      </div>
    )
  }
  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        change.mutate(password)
      }}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">{t("reset.newPassword")}</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          aria-describedby="new-password-hint"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
          }}
        />
        <p id="new-password-hint" className="text-xs text-muted-foreground">
          {t("invite.passwordHint")}
        </p>
      </div>
      {change.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t(passwordRuleText(change.error) ?? "reset.expired")}
        </p>
      ) : null}
      <Button type="submit" disabled={password.length < MIN_PASSWORD || change.isPending}>
        {t("reset.save")}
      </Button>
    </form>
  )
}

/**
 * A staff member's forgotten password (F12.6): the address, then a link by
 * e-mail back to this page with its token. 2FA is still asked at sign-in.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const search = useSearch({ from: "/reset-password" })
  // From the link's fragment; an older link's query still works
  const [token] = useState(() => linkParams().get("token") ?? search.token)
  return (
    <AuthShell>
      <AuthHeading
        title={t(token ? "reset.newTitle" : "reset.title")}
        subtitle={t(token ? "reset.newSubtitle" : "reset.subtitle")}
      />
      {token ? <NewPasswordForm token={token} /> : <RequestForm />}
      <Button asChild variant="link" className="mt-4 h-auto px-0">
        <Link to="/login">{t("reset.back")}</Link>
      </Button>
    </AuthShell>
  )
}
