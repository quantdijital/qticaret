import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useConfirmFactor, useRecoveryCodes, useStartFactor } from "@/features/auth/api/mfa"
import { useCurrentUser, useLogout } from "@/features/auth/api/me"
import { AuthenticatorLink } from "@/features/security/components/authenticator-link"
import { RecoveryCodes } from "@/features/security/components/recovery-codes"
import { errorText } from "@/lib/errors"

type Step = "app" | "codes" | "done"

/**
 * 2FA setup (F12.6, adr/0040 §2), required before anything else: the
 * authenticator app, its first code, the recovery codes; then a new sign-in
 * with the code, so the session itself has passed it.
 */
export function MfaSetupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const logout = useLogout(() => void navigate({ to: "/login" }))
  const start = useStartFactor()
  const confirm = useConfirmFactor()
  const recovery = useRecoveryCodes()
  const [step, setStep] = useState<Step>("app")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [kept, setKept] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    // Once: a second factor started would wait unconfirmed beside the first
    if (user?.email && !started.current) {
      started.current = true
      start.mutate(user.email)
    }
  }, [user?.email, start])

  const factor = start.data
  // The start's failure has its own place, with a way to try again
  const failure = confirm.error ?? recovery.error

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-lg border bg-card p-6">
        <div>
          <h1 className="text-lg font-semibold">{t(`security.setup.${step}.title`)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(`security.setup.${step}.text`)}</p>
        </div>
        {step === "app" ? (
          factor ? (
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                confirm.mutate(
                  { id: factor.id, code: code.trim(), password },
                  {
                    onSuccess: () => {
                      // The setup's own code proves the person for their first codes
                      recovery.mutate(code.trim(), {
                        onSuccess: () => {
                          setStep("codes")
                        },
                      })
                    },
                  }
                )
              }}
            >
              <AuthenticatorLink factor={factor} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="first-code">{t("security.setup.code")}</Label>
                <Input
                  id="first-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="setup-password">{t("security.setup.password")}</Label>
                <Input
                  id="setup-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                  }}
                />
                <p className="text-xs text-muted-foreground">{t("security.setup.passwordHint")}</p>
              </div>
              <Button
                type="submit"
                disabled={
                  !/^\d{6}$/.test(code.trim()) ||
                  password === "" ||
                  confirm.isPending ||
                  recovery.isPending
                }
              >
                {confirm.isPending || recovery.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t("security.setup.confirm")}
              </Button>
            </form>
          ) : start.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-destructive">{t("security.setup.startFailed")}</p>
              <Button
                variant="outline"
                onClick={() => {
                  if (user?.email) {
                    start.mutate(user.email)
                  }
                }}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : (
            <div aria-busy="true" className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )
        ) : null}
        {step === "codes" && recovery.data ? (
          <>
            <RecoveryCodes codes={recovery.data} />
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={kept}
                onCheckedChange={(checked) => {
                  setKept(checked === true)
                }}
              />
              {t("security.setup.kept")}
            </label>
            <Button
              disabled={!kept}
              onClick={() => {
                setStep("done")
              }}
            >
              {t("security.setup.next")}
            </Button>
          </>
        ) : null}
        {step === "done" ? (
          <Button
            onClick={() => {
              logout.mutate()
            }}
          >
            {t("security.setup.signInAgain")}
          </Button>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {(failure as { status?: number }).status === 428
              ? t("security.setup.wrongPassword")
              : (failure as { status?: number }).status === 400 ||
                  (failure as { status?: number }).status === 401
                ? t("security.setup.wrong")
                : errorText(t, failure)}
          </p>
        ) : null}
        {step !== "done" ? (
          <Button
            variant="link"
            className="h-auto self-start px-0"
            onClick={() => {
              logout.mutate()
            }}
          >
            {t("security.setup.later")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
