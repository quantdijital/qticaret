import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useVerifyChallenge } from "@/features/auth/api"
import type { Challenge } from "@/features/auth/api"
import { codeOf, statusOf } from "@/lib/api"
import { errorText } from "@/lib/errors"

/**
 * A wrong code, a code already used, a challenge past its five minutes or
 * its five tries: all "try again" to the person (Medusa's own refusals are
 * 401 or 400; the control plane's `cp.mfa_code_used`, `cp.challenge_unknown`).
 */
function failureText(t: ReturnType<typeof useTranslation>["t"], error: unknown): string {
  const status = statusOf(error)
  if (codeOf(error) === "cp.sign_in_locked" || status === 429) {
    return errorText(t, error)
  }
  if (codeOf(error) === "cp.challenge_unknown") {
    return t("auth.code.expired")
  }
  return status === 400 || status === 401 ? t("auth.code.wrong") : errorText(t, error)
}

/**
 * The sign-in's second step (adr/0061 §3.5): the authenticator's six
 * digits, or one of the recovery codes when the phone is not at hand.
 */
export function CodeStep({
  challenge,
  onPassed,
  onBack,
}: {
  challenge: Challenge
  onPassed: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const verify = useVerifyChallenge()
  const recovery = challenge.methods.includes("recovery_code")
  const [method, setMethod] = useState<"totp" | "recovery_code">("totp")
  const [code, setCode] = useState("")
  const ready = method === "totp" ? /^\d{6}$/.test(code.trim()) : code.trim().length >= 6
  const failure = verify.error ? failureText(t, verify.error) : null
  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) {
          verify.mutate({ challenge, method, code: code.trim() }, { onSuccess: onPassed })
        }
      }}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">
          {t(method === "totp" ? "auth.code.app" : "auth.code.recovery")}
        </Label>
        <Input
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
          {t(method === "totp" ? "auth.code.appHint" : "auth.code.recoveryHint")}
        </p>
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      ) : null}
      <Button type="submit" className="mt-2" disabled={!ready || verify.isPending}>
        {t("auth.code.submit")}
      </Button>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="link" className="h-auto px-0" onClick={onBack}>
          {t("auth.code.back")}
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
            {t(method === "totp" ? "auth.code.useRecovery" : "auth.code.useApp")}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
