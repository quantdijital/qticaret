import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useLogin } from "@/features/auth/api/me"
import type { MfaChallenge } from "@/features/auth/api/me"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { CodeStep } from "@/features/auth/components/code-step"
import { PasswordInput } from "@/features/auth/components/password-input"
import { useStaffTurnstile } from "@/features/auth/components/staff-turnstile"
import { isTurnstileRefusal } from "@/features/auth/api/gated-post"
import { errorText, isUnauthorized } from "@/lib/errors"

const schema = z.object({
  email: z.email({ message: "login.required" }),
  password: z.string().min(1, { message: "login.required" }),
})
type Form = z.infer<typeof schema>

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: "/login" })
  // Every sign-in carries Turnstile's token (adr/0044 Ek 2026-11-24)
  const turnstile = useStaffTurnstile("staff_login")
  const login = useLogin(turnstile.gate)
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)
  const done = () => void navigate({ to: redirect ?? "/" })
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (asked) => {
        if (asked) {
          setChallenge(asked)
        } else {
          done()
        }
      },
    })
  })
  const failure = login.error
    ? isUnauthorized(login.error)
      ? t("login.failed")
      : isTurnstileRefusal(login.error)
        ? t("login.turnstile.failed")
        : errorText(t, login.error)
    : null

  return (
    <AuthShell
      after={
        challenge ? null : (
          <p className="text-center text-[13px] text-muted-foreground">{t("login.noAccount")}</p>
        )
      }
    >
      <AuthHeading
        title={t(challenge ? "login.mfa.title" : "login.title")}
        subtitle={t(challenge ? "login.mfa.subtitle" : "login.subtitle")}
      />
      {challenge ? (
        <CodeStep
          challenge={challenge}
          onPassed={done}
          onBack={() => {
            setChallenge(null)
            login.reset()
          }}
        />
      ) : (
        <form
          className="mt-8 flex flex-col gap-5"
          onSubmit={(event) => {
            void submit(event)
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
              aria-invalid={errors.email ? true : undefined}
              {...form.register("email")}
            />
            {errors.email?.message ? (
              <p className="text-xs text-destructive">{t(errors.email.message)}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              {...form.register("password")}
            />
            {errors.password?.message ? (
              <p className="text-xs text-destructive">{t(errors.password.message)}</p>
            ) : null}
            <Button asChild variant="link" className="h-auto self-end px-0 text-[13px]">
              <Link to="/reset-password">{t("login.forgot")}</Link>
            </Button>
          </div>
          {turnstile.slot}
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {t("login.submit")}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
