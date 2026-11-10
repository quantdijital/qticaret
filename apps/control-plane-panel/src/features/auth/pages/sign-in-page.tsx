import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useSignIn } from "@/features/auth/api"
import type { Challenge } from "@/features/auth/api"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { CodeStep } from "@/features/auth/components/code-step"
import { PasswordInput } from "@/features/auth/components/password-input"
import { statusOf } from "@/lib/api"
import { errorText } from "@/lib/errors"

const schema = z.object({
  email: z.email({ message: "auth.required" }),
  password: z.string().min(1, { message: "auth.required" }),
})
type Form = z.infer<typeof schema>

/**
 * Sign-in (adr/0061 §3.5): e-mail and password, then the authenticator's
 * code. A member who has not set 2FA up yet is signed in at once and led
 * to its setup by the route guard. Then on to where they were headed.
 */
export function SignInPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: "/login" })
  const onDone = () => void navigate({ to: redirect ?? "/" })
  const signIn = useSignIn()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    signIn.mutate(values, {
      onSuccess: (asked) => {
        if (asked) {
          setChallenge(asked)
        } else {
          onDone()
        }
      },
    })
  })
  const failure = signIn.error
    ? statusOf(signIn.error) === 401
      ? t("auth.signIn.failed")
      : errorText(t, signIn.error)
    : null

  return (
    <AuthShell
      after={
        challenge ? null : (
          <p className="text-center text-[13px] text-muted-foreground">
            {t("auth.signIn.noAccount")}
          </p>
        )
      }
    >
      <AuthHeading
        title={t(challenge ? "auth.code.title" : "auth.signIn.title")}
        subtitle={t(challenge ? "auth.code.subtitle" : "auth.signIn.subtitle")}
      />
      {challenge ? (
        <CodeStep
          challenge={challenge}
          onPassed={onDone}
          onBack={() => {
            setChallenge(null)
            signIn.reset()
          }}
        />
      ) : (
        <form
          className="mt-8 flex flex-col gap-5"
          onSubmit={(event) => {
            void submit(event)
          }}
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
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
            <Label htmlFor="password">{t("auth.password")}</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              {...form.register("password")}
            />
            {errors.password?.message ? (
              <p className="text-xs text-destructive">{t(errors.password.message)}</p>
            ) : null}
          </div>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={signIn.isPending}>
            {t("auth.signIn.submit")}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
