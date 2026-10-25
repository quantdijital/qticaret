import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLogin } from "@/features/auth/api/me"
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
  const login = useLogin()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => void navigate({ to: redirect ?? "/" }),
    })
  })
  const failure = login.error
    ? isUnauthorized(login.error)
      ? t("login.failed")
      : errorText(t, login.error)
    : null

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        <h1 className="text-lg font-semibold">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(event) => {
            void submit(event)
          }}
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
            <Input
              id="password"
              type="password"
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
          <Button type="submit" className="mt-2" disabled={login.isPending}>
            {t("login.submit")}
          </Button>
        </form>
      </div>
    </div>
  )
}
