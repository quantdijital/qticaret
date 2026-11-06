import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { KeyRound, Smartphone } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
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
import { Switch } from "@/components/ui/switch"
import { factorsQuery, useDisableFactor, useRecoveryCodes } from "@/features/auth/api/mfa"
import { useStaff } from "@/features/auth/api/staff"
import { RecoveryCodes } from "@/features/security/components/recovery-codes"
import { errorText } from "@/lib/errors"

const S = "settings.security.mine"

/** The factor turned off with the app's current code; then set up again or left off. */
function TurnOffDialog({
  factorId,
  next,
  onClose,
}: {
  factorId: string
  /** After it: a new phone's setup, or nothing more. */
  next: "setup" | "off"
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const disable = useDisableFactor()
  const [code, setCode] = useState("")
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(`${S}.${next === "setup" ? "changeTitle" : "offTitle"}`)}</DialogTitle>
          <DialogDescription>
            {t(`${S}.${next === "setup" ? "changeHint" : "offHint"}`)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-code">{t("login.mfa.code")}</Label>
          <Input
            id="current-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!/^\d{6}$/.test(code.trim()) || disable.isPending}
            onClick={() => {
              disable.mutate(
                { id: factorId, code: code.trim() },
                {
                  onSuccess: () => {
                    if (next === "setup") {
                      void navigate({ to: "/security/setup" })
                    } else {
                      toast.success(t(`${S}.turnedOff`))
                      onClose()
                    }
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {t(`${S}.${next === "setup" ? "change" : "turnOff"}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The signed-in person's own 2FA (F12.6, adr/0040 §2): on (its setup), off
 * (with the app's code, unless the shop requires it), new recovery codes,
 * a new phone. Any role: it is their account.
 */
export function MyMfaCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const staff = useStaff()
  const enabled = staff?.mfa.enabled === true
  const factors = useQuery({ ...factorsQuery(), enabled })
  const recovery = useRecoveryCodes()
  const [turningOff, setTurningOff] = useState<"setup" | "off" | null>(null)
  const factor = factors.data?.find((each) => each.status === "enabled")
  const available = staff?.mfa.available === true
  // Required by the shop: on it stays; turned off it would be asked again at sign-in
  const locked = !available || (enabled && staff.mfa.required)
  const note = !available
    ? `${S}.unavailable`
    : enabled && staff.mfa.required
      ? `${S}.lockedOn`
      : enabled
        ? `${S}.onHint`
        : `${S}.offHint2`

  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={t(note)}
      className={className}
      action={
        <Switch
          aria-label={t(`${S}.title`)}
          checked={enabled}
          disabled={locked || (enabled && !factor)}
          onCheckedChange={(on) => {
            if (on) {
              void navigate({ to: "/security/setup" })
            } else {
              setTurningOff("off")
            }
          }}
        />
      }
    >
      {enabled ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={recovery.isPending}
              onClick={() => {
                recovery.mutate(undefined, {
                  onError: (failure) => toast.error(errorText(t, failure)),
                })
              }}
            >
              <KeyRound />
              {t(`${S}.newCodes`)}
            </Button>
            <Button
              variant="outline"
              disabled={!factor}
              onClick={() => {
                setTurningOff("setup")
              }}
            >
              <Smartphone />
              {t(`${S}.change`)}
            </Button>
          </div>
          {recovery.data ? (
            <RecoveryCodes
              codes={recovery.data}
              onDone={() => {
                recovery.reset()
              }}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${S}.notSet`)}</p>
      )}
      {factor && turningOff ? (
        <TurnOffDialog
          factorId={factor.id}
          next={turningOff}
          onClose={() => {
            setTurningOff(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
