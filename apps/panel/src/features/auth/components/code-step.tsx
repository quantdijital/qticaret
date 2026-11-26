import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useVerifyChallenge } from "@/features/auth/api/me"
import type { MfaChallenge } from "@/features/auth/api/me"
import { errorText, isUnauthorized } from "@/lib/errors"

/**
 * The sign-in's second step (adr/0040 §2): the authenticator's six digits,
 * or one of the recovery codes when the phone is not at hand.
 */
export function CodeStep({
  challenge,
  onPassed,
  onBack,
}: {
  challenge: MfaChallenge
  onPassed: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const verify = useVerifyChallenge()
  const recovery = challenge.methods.includes("recovery_code")
  const [method, setMethod] = useState<"totp" | "recovery_code">("totp")
  const [code, setCode] = useState("")
  const ready = method === "totp" ? /^\d{6}$/.test(code) : code.trim().length >= 6
  const failure = verify.error
    ? isUnauthorized(verify.error) || (verify.error as { status?: number }).status === 400
      ? t("login.mfa.wrong")
      : errorText(t, verify.error)
    : null
  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) {
          verify.mutate({ id: challenge.id, method, code: code.trim() }, { onSuccess: onPassed })
        }
      }}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">
          {t(method === "totp" ? "login.mfa.code" : "login.mfa.recoveryCode")}
        </Label>
        <Input
          // placeholder-exempt: a one-time code has no example
          id="code"
          autoFocus
          aria-describedby="code-hint"
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
          }}
          {...(method === "totp"
            ? { inputMode: "numeric" as const, autoComplete: "one-time-code", maxLength: 6 }
            : { autoComplete: "off" })}
        />
        <p id="code-hint" className="text-xs text-muted-foreground">
          {t(method === "totp" ? "login.mfa.codeHint" : "login.mfa.recoveryHint")}
        </p>
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      ) : null}
      <Button type="submit" className="mt-2" disabled={!ready || verify.isPending}>
        {t("login.mfa.submit")}
      </Button>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="link" className="h-auto px-0" onClick={onBack}>
          {t("login.mfa.back")}
        </Button>
        {recovery ? (
          <Button
            type="button"
            variant="link"
            className="h-auto px-0"
            onClick={() => {
              setMethod(method === "totp" ? "recovery_code" : "totp")
              setCode("")
              verify.reset()
            }}
          >
            {t(method === "totp" ? "login.mfa.useRecovery" : "login.mfa.useApp")}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
