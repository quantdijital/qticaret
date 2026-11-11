import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { flagName, flagText } from "@/features/packages/format"
import type { EffectiveFlag, FeatureOverride } from "@/features/tenants/api"
import { useRemoveFeatureOverride, useSetFeatureOverride } from "@/features/tenants/mutations"
import { errorText } from "@/lib/errors"

/** The day's end in Istanbul, as the control plane takes a moment. */
const endOfDay = (day: string) => new Date(`${day}T23:59:59+03:00`).toISOString()
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(iso))
const today = () => dayOf(new Date().toISOString())

/**
 * A shop's own value for one platform flag (adr/0061 Ek C9), over its
 * package's: on or off, why, and until when (empty: no end). As the limit
 * exceptions' dialog; removing it brings the package's value back.
 */
export function FeatureOverrideDialog({
  tenantId,
  flag,
  override,
  onClose,
}: {
  tenantId: string
  flag: EffectiveFlag
  override: FeatureOverride | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const set = useSetFeatureOverride(tenantId)
  const remove = useRemoveFeatureOverride(tenantId)
  const [enabled, setEnabled] = useState(override?.enabled ?? !flag.value)
  const [reason, setReason] = useState(override?.reason ?? "")
  const [until, setUntil] = useState(override?.expires_at ? dayOf(override.expires_at) : "")
  const [failure, setFailure] = useState<string | null>(null)
  const valid = reason.trim().length >= 3 && (until === "" || until >= today())
  const start = JSON.stringify([
    override?.enabled ?? !flag.value,
    override?.reason ?? "",
    override?.expires_at ? dayOf(override.expires_at) : "",
  ])
  const fail = (error: unknown) => {
    setFailure(errorText(t, error))
  }
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={flagName(t, flag.key)}
      description={t("flags.overrideText", { value: flagText(t, flag.package ?? flag.default) })}
      dirty={override === null || start !== JSON.stringify([enabled, reason, until])}
      saving={set.isPending}
      canSubmit={valid}
      footerStart={
        override ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(flag.key, {
                onSuccess: () => {
                  toast.success(t("override.removed"))
                  onClose()
                },
                onError: fail,
              })
            }}
          >
            {t("override.remove")}
          </Button>
        ) : undefined
      }
      onSubmit={() => {
        setFailure(null)
        set.mutate(
          {
            key: flag.key,
            enabled,
            reason: reason.trim(),
            expires_at: until ? endOfDay(until) : null,
          },
          {
            onSuccess: () => {
              toast.success(t("override.saved"))
              onClose()
            },
            onError: fail,
          }
        )
      }}
    >
      <DialogBody>
        <div className="flex items-center gap-2">
          <Checkbox
            id="feature-override-enabled"
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked === true)
            }}
          />
          <Label htmlFor="feature-override-enabled" className="font-normal">
            {t("flags.enabled")}
          </Label>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="feature-override-reason">{t("override.reason")}</Label>
          <Textarea
            id="feature-override-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-2 sm:max-w-56">
          <Label htmlFor="feature-override-until">{t("override.until")}</Label>
          <Input
            id="feature-override-until"
            type="date"
            min={today()}
            value={until}
            onChange={(event) => {
              setUntil(event.target.value)
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("override.untilHelp")}</p>
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
