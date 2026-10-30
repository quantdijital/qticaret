import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStaff } from "@/features/auth/api/staff"
import { setReauthAsker } from "@/lib/reauth"
import type { ReauthAsk, ReauthMethod } from "@/lib/reauth"

/**
 * The dialog a sensitive change opens (F12.6, adr/0040 §3): the app's code,
 * a recovery code, or, without 2FA, the password. Mounted once in the shell.
 */
export function ReauthHost() {
  const { t } = useTranslation()
  const staff = useStaff()
  const [ask, setAsk] = useState<ReauthAsk | null>(null)
  const [secret, setSecret] = useState("")
  const [recovery, setRecovery] = useState(false)
  const withCode = staff?.mfa.enabled === true
  const method: ReauthMethod = withCode ? (recovery ? "recovery_code" : "totp") : "password"

  useEffect(() => {
    setReauthAsker((next) => {
      setSecret("")
      setAsk(next)
    })
    return () => {
      setReauthAsker(null)
    }
  }, [])

  const close = (proof: { method: ReauthMethod; secret: string } | null) => {
    ask?.answer(proof)
    setAsk(null)
  }
  const ready =
    method === "totp"
      ? /^\d{6}$/.test(secret.trim())
      : secret.trim().length >= (method === "password" ? 1 : 6)

  return (
    <Dialog
      open={ask !== null}
      onOpenChange={(open) => {
        if (!open) {
          close(null)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (ready) {
              close({ method, secret: secret.trim() })
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("reauth.title")}</DialogTitle>
            <DialogDescription>
              {t(withCode ? "reauth.withCode" : "reauth.withPassword")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reauth-secret">
              {t(
                method === "totp"
                  ? "login.mfa.code"
                  : method === "recovery_code"
                    ? "login.mfa.recoveryCode"
                    : "login.password"
              )}
            </Label>
            <Input
              id="reauth-secret"
              autoFocus
              value={secret}
              onChange={(event) => {
                setSecret(event.target.value)
              }}
              {...(method === "totp"
                ? { inputMode: "numeric" as const, autoComplete: "one-time-code", maxLength: 6 }
                : method === "password"
                  ? { type: "password", autoComplete: "current-password" }
                  : { autoComplete: "off" })}
            />
            {ask?.failed ? (
              <p role="alert" className="text-sm text-destructive">
                {t(method === "password" ? "reauth.failedPassword" : "reauth.failed")}
              </p>
            ) : null}
            {withCode ? (
              <Button
                type="button"
                variant="link"
                className="h-auto self-start px-0"
                onClick={() => {
                  setRecovery(!recovery)
                  setSecret("")
                }}
              >
                {t(recovery ? "login.mfa.useApp" : "login.mfa.useRecovery")}
              </Button>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                close(null)
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!ready}>
              {t("reauth.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
