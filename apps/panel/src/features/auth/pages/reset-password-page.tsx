import { useMutation } from "@tanstack/react-query"
import { Link, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { passwordRuleText } from "@/features/auth/password-rule"
import { sdk } from "@/lib/sdk"
import { linkParams } from "@/lib/link-params"

// docs/04: length first, ten characters at least
const MIN_PASSWORD = 10

/** The address a reset link goes to; the same answer whether it has a login or not. */
function RequestForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const request = useMutation({
    mutationFn: (identifier: string) => sdk.auth.resetPassword("user", "emailpass", { identifier }),
  })
  if (request.isSuccess) {
    return <p className="mt-6 text-sm">{t("reset.sent")}</p>
  }
  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        request.mutate(email.trim())
      }}
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
      {request.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.generic")}
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
      <div className="mt-6 flex flex-col gap-4">
        <p className="text-sm">{t("reset.changed")}</p>
        <Button asChild>
          <Link to="/login">{t("reset.toLogin")}</Link>
        </Button>
      </div>
    )
  }
  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        change.mutate(password)
      }}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">{t("reset.newPassword")}</Label>
        <Input
          id="new-password"
          type="password"
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
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        <h1 className="text-lg font-semibold">{t(token ? "reset.newTitle" : "reset.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(token ? "reset.newSubtitle" : "reset.subtitle")}
        </p>
        {token ? <NewPasswordForm token={token} /> : <RequestForm />}
        <Button asChild variant="link" className="mt-4 h-auto px-0">
          <Link to="/login">{t("reset.back")}</Link>
        </Button>
      </div>
    </div>
  )
}
