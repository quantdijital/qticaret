import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { InviteFailure, acceptInvite, inviteInfoQuery } from "@/features/auth/api/invite"
import { TURNSTILE_FAILED, TURNSTILE_REQUIRED } from "@qticaret/types/turnstile"
import { isTurnstileRefusal } from "@/features/auth/api/gated-post"
import { useLogin } from "@/features/auth/api/me"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { useStaffTurnstile } from "@/features/auth/components/staff-turnstile"
import { PasswordInput } from "@/features/auth/components/password-input"
import { passwordRuleText } from "@/features/auth/password-rule"
import { linkParams } from "@/lib/link-params"

// docs/04: length first, ten characters at least
const MIN_PASSWORD = 10

const schema = z.object({
  first_name: z.string().trim().min(1, { message: "invite.required" }),
  last_name: z.string().trim().min(1, { message: "invite.required" }),
  password: z.string().min(MIN_PASSWORD, { message: "invite.passwordShort" }),
})
type Form = z.infer<typeof schema>

// What the API's keys mean on this page; anything else reads as the generic line
const FAILURES: Record<string, string> = {
  "staff.invite_invalid": "invite.invalid",
  "staff.invite_login": "invite.wrongLogin",
  "staff.name_required": "invite.required",
}

const failureKey = (error: unknown) =>
  passwordRuleText(error) ??
  (isTurnstileRefusal(error) ||
  (error instanceof InviteFailure &&
    (error.key === TURNSTILE_FAILED || error.key === TURNSTILE_REQUIRED))
    ? "login.turnstile.failed"
    : error instanceof InviteFailure && error.key
      ? (FAILURES[error.key] ?? "errors.generic")
      : "errors.generic")

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string | undefined
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{t(error)}</p> : null}
    </div>
  )
}

/** The page an invitation's link opens (F12.6): the new member names themselves and sets a password. */
export function InvitePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: "/invite" })
  // From the link's fragment; an older link's query still works
  const [token] = useState(() => linkParams().get("token") ?? search.token)
  const info = useQuery({ ...inviteInfoQuery(token ?? ""), enabled: Boolean(token) })
  // Turnstile (adr/0044 Ek 2026-11-24): the login's creation, then the sign-in that follows (and an
  // earlier try's login), each with its own gate's token
  const registering = useStaffTurnstile("staff_register")
  const turnstile = useStaffTurnstile("staff_login")
  const login = useLogin(turnstile.gate)
  const accept = useMutation({
    mutationFn: (input: Parameters<typeof acceptInvite>[0]) =>
      acceptInvite(input, { register: registering.gate, login: turnstile.gate }),
  })
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: "", last_name: "", password: "" },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    if (!token || !info.data) {
      return
    }
    const { email } = info.data
    accept.mutate(
      { ...values, token, email },
      {
        onSuccess: () => {
          login.mutate(
            { email, password: values.password },
            { onSuccess: () => void navigate({ to: "/" }) }
          )
        },
      }
    )
  })

  return (
    <AuthShell>
      {!token || info.isError ? (
        <div role="alert">
          <AuthHeading title={t("invite.invalidTitle")} subtitle={t("invite.invalid")} />
        </div>
      ) : info.isPending ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <AuthHeading
            title={t("invite.title")}
            subtitle={t("invite.subtitle", {
              email: info.data.email,
              role: t(`staff.roles.${info.data.role}`),
            })}
          />
          <form
            className="mt-8 flex flex-col gap-5"
            onSubmit={(event) => {
              void submit(event)
            }}
            onFocus={registering.warm}
            onPointerDown={registering.warm}
            noValidate
          >
            <Field id="invite-email" label={t("login.email")}>
              <Input id="invite-email" value={info.data.email} readOnly autoComplete="username" />
            </Field>
            <Field id="first-name" label={t("invite.firstName")} error={errors.first_name?.message}>
              <Input id="first-name" autoComplete="given-name" {...form.register("first_name")} />
            </Field>
            <Field id="last-name" label={t("invite.lastName")} error={errors.last_name?.message}>
              <Input id="last-name" autoComplete="family-name" {...form.register("last_name")} />
            </Field>
            <Field id="password" label={t("login.password")} error={errors.password?.message}>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                aria-describedby="password-hint"
                {...form.register("password")}
              />
              <p id="password-hint" className="text-xs text-muted-foreground">
                {t("invite.passwordHint")}
              </p>
            </Field>
            {registering.slot}
            {turnstile.slot}
            {accept.error || login.error ? (
              <p role="alert" className="text-sm text-destructive">
                {t(failureKey(accept.error ?? login.error))}
              </p>
            ) : null}
            <Button type="submit" className="mt-2" disabled={accept.isPending || login.isPending}>
              {t("invite.submit")}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
