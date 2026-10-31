import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InviteFailure, acceptInvite, inviteInfoQuery } from "@/features/auth/api/invite"
import { useLogin } from "@/features/auth/api/me"
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
  (error instanceof InviteFailure && error.key
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
  const login = useLogin()
  const accept = useMutation({ mutationFn: acceptInvite })
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
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        {!token || info.isError ? (
          <div role="alert">
            <h1 className="text-lg font-semibold">{t("invite.invalidTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("invite.invalid")}</p>
          </div>
        ) : info.isPending ? (
          <LoadingRows rows={4} />
        ) : (
          <>
            <h1 className="text-lg font-semibold">{t("invite.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("invite.subtitle", {
                email: info.data.email,
                role: t(`staff.roles.${info.data.role}`),
              })}
            </p>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(event) => {
                void submit(event)
              }}
              noValidate
            >
              <Field id="invite-email" label={t("login.email")}>
                <Input id="invite-email" value={info.data.email} readOnly autoComplete="username" />
              </Field>
              <Field
                id="first-name"
                label={t("invite.firstName")}
                error={errors.first_name?.message}
              >
                <Input id="first-name" autoComplete="given-name" {...form.register("first_name")} />
              </Field>
              <Field id="last-name" label={t("invite.lastName")} error={errors.last_name?.message}>
                <Input id="last-name" autoComplete="family-name" {...form.register("last_name")} />
              </Field>
              <Field id="password" label={t("login.password")} error={errors.password?.message}>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  {...form.register("password")}
                />
                <p id="password-hint" className="text-xs text-muted-foreground">
                  {t("invite.passwordHint")}
                </p>
              </Field>
              {accept.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {t(failureKey(accept.error))}
                </p>
              ) : null}
              <Button type="submit" className="mt-2" disabled={accept.isPending || login.isPending}>
                {t("invite.submit")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
