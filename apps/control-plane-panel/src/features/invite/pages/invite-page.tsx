import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { PasswordInput } from "@/features/auth/components/password-input"
import { inviteInfoQuery, useAcceptInvite } from "@/features/invite/api"
import { errorText } from "@/lib/errors"
import { takeLinkToken } from "@/lib/link-token"

// The control plane takes any password; a staff account deserves a long one
export const MIN_PASSWORD = 12

const schema = z
  .object({
    first_name: z.string().trim().min(1, { message: "auth.required" }).max(100),
    last_name: z.string().trim().min(1, { message: "auth.required" }).max(100),
    password: z.string().min(MIN_PASSWORD, { message: "invite.passwordShort" }).max(1024),
    repeat: z.string(),
  })
  .refine((values) => values.password === values.repeat, {
    message: "invite.passwordMismatch",
    path: ["repeat"],
  })
type Form = z.infer<typeof schema>

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error: string | undefined
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {t(error, { count: MIN_PASSWORD })}
        </p>
      ) : null}
    </div>
  )
}

function AcceptForm({
  token,
  email,
  onDone,
}: {
  token: string
  email: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const accept = useAcceptInvite()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: "", last_name: "", password: "", repeat: "" },
  })
  const { errors } = form.formState
  const submit = form.handleSubmit((values) => {
    accept.mutate(
      {
        token,
        email,
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        password: values.password,
      },
      { onSuccess: onDone }
    )
  })
  const invalid = (name: keyof Form) => (errors[name] ? { "aria-invalid": true as const } : {})
  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={(event) => {
        void submit(event)
      }}
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="first_name" label={t("invite.firstName")} error={errors.first_name?.message}>
          <Input
            id="first_name"
            autoComplete="given-name"
            {...invalid("first_name")}
            {...form.register("first_name")}
          />
        </Field>
        <Field id="last_name" label={t("invite.lastName")} error={errors.last_name?.message}>
          <Input
            id="last_name"
            autoComplete="family-name"
            {...invalid("last_name")}
            {...form.register("last_name")}
          />
        </Field>
      </div>
      <Field id="password" label={t("invite.password")} error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-describedby="password-hint"
          {...invalid("password")}
          {...form.register("password")}
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          {t("invite.passwordHint", { count: MIN_PASSWORD })}
        </p>
      </Field>
      <Field id="repeat" label={t("invite.repeat")} error={errors.repeat?.message}>
        <PasswordInput
          id="repeat"
          autoComplete="new-password"
          {...invalid("repeat")}
          {...form.register("repeat")}
        />
      </Field>
      {accept.error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(t, accept.error)}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={accept.isPending}>
        {t("invite.submit")}
      </Button>
    </form>
  )
}

/**
 * An invitation's page (`/invite#token=…`, adr/0061 Ek C4): what it is for,
 * then a name and a password; the account is made and signed in, and the
 * 2FA setup comes next.
 */
export function InvitePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Accepted and signed in: the 2FA setup is next, before anything else
  const onAccepted = () => void navigate({ to: "/security/setup" })
  const [token] = useState(takeLinkToken)
  const info = useQuery({ ...inviteInfoQuery(token ?? ""), enabled: token !== null })
  if (token === null || info.isError) {
    return (
      <AuthShell>
        <div role="alert">
          <AuthHeading
            title={t("invite.invalid.title")}
            subtitle={info.isError ? errorText(t, info.error) : t("invite.invalid.text")}
          />
        </div>
      </AuthShell>
    )
  }
  if (!info.data) {
    return (
      <AuthShell>
        <div aria-busy="true" className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      </AuthShell>
    )
  }
  return (
    <AuthShell>
      <AuthHeading
        title={t("invite.title")}
        subtitle={t("invite.subtitle", {
          email: info.data.email,
          role: t(`roles.${info.data.role}`),
        })}
      />
      <AcceptForm token={token} email={info.data.email} onDone={onAccepted} />
    </AuthShell>
  )
}
