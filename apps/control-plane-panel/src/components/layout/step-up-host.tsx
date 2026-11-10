import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { setStepUpAsker } from "@/lib/step-up"
import type { StepUpAsk, StepUpMethod } from "@/lib/step-up"

/**
 * The re-authentication dialog (adr/0061 §3.5): a sensitive change asks
 * for the app's code, or a recovery code when the phone is not at hand.
 * The code becomes a five-minute proof (lib/step-up.ts) and the change is
 * made again. Mounted once in the shell; what was typed goes with it.
 */
export function StepUpHost() {
  const { t } = useTranslation()
  const [ask, setAsk] = useState<StepUpAsk | null>(null)
  const [code, setCode] = useState("")
  const [method, setMethod] = useState<StepUpMethod>("totp")

  useEffect(() => {
    setStepUpAsker((next) => {
      setCode("")
      setAsk(next)
    })
    return () => {
      setStepUpAsker(null)
    }
  }, [])

  const close = (proof: { method: StepUpMethod; code: string } | null) => {
    ask?.answer(proof)
    setAsk(null)
    setCode("")
  }
  const ready = method === "totp" ? /^\d{6}$/.test(code.trim()) : code.trim().length >= 6

  return (
    <Dialog
      open={ask !== null}
      onOpenChange={(open) => {
        if (!open) {
          close(null)
        }
      }}
    >
      <DialogContent size="sm">
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (ready) {
              close({ method, code: code.trim() })
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("stepUp.title")}</DialogTitle>
            <DialogDescription>{t("stepUp.text")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-2">
              <Label htmlFor="step-up-code">
                {t(method === "totp" ? "auth.code.app" : "auth.code.recovery")}
              </Label>
              <Input
                id="step-up-code"
                autoFocus
                value={code}
                onChange={(event) => {
                  setCode(event.target.value)
                }}
                {...(method === "totp"
                  ? { inputMode: "numeric" as const, autoComplete: "one-time-code", maxLength: 6 }
                  : { autoComplete: "off" })}
              />
              {ask?.failed ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("stepUp.failed")}
                </p>
              ) : null}
              <Button
                type="button"
                variant="link"
                className="h-auto self-start px-0"
                onClick={() => {
                  setMethod(method === "totp" ? "recovery_code" : "totp")
                  setCode("")
                }}
              >
                {t(method === "totp" ? "auth.code.useRecovery" : "auth.code.useApp")}
              </Button>
            </div>
          </DialogBody>
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
              {t("stepUp.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
