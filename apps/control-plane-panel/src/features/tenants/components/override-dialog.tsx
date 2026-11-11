import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import { limitText } from "@/features/packages/format"
import type { EffectiveLimit, Override } from "@/features/tenants/api"
import { useRemoveOverride, useSetOverride } from "@/features/tenants/mutations"
import { errorText } from "@/lib/errors"

/** The day's end in Istanbul, as the control plane takes a moment. */
const endOfDay = (day: string) => new Date(`${day}T23:59:59+03:00`).toISOString()
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(iso))
const today = () => dayOf(new Date().toISOString())

/** What the form starts from, for telling a change. */
const stateOf = (override: Override) =>
  JSON.stringify([
    override.value === null,
    override.value === null ? "" : String(override.value),
    override.reason,
    override.expires_at ? dayOf(override.expires_at) : "",
  ])

/**
 * A shop's own value for one limit (adr/0061 §2), over its package's:
 * a count (or megabytes) or no limit, why, and until when (empty: no
 * end). Removing it brings the package's value back.
 */
export function OverrideDialog({
  tenantId,
  limit,
  override,
  onClose,
}: {
  tenantId: string
  limit: EffectiveLimit
  override: Override | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const set = useSetOverride(tenantId)
  const remove = useRemoveOverride(tenantId)
  const [unlimited, setUnlimited] = useState(override?.value === null)
  const [value, setValue] = useState(
    typeof override?.value === "number" ? String(override.value) : ""
  )
  const [reason, setReason] = useState(override?.reason ?? "")
  const [until, setUntil] = useState(override?.expires_at ? dayOf(override.expires_at) : "")
  const [failure, setFailure] = useState<string | null>(null)
  const amount = parseCountInput(value)
  const valid =
    reason.trim().length >= 3 &&
    (unlimited || amount !== null) &&
    (until === "" || until >= today())
  const fail = (error: unknown) => {
    setFailure(errorText(t, error))
  }
  const label = t(`limits.keys.${limit.key}`)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={label}
      description={t("override.text", { value: limitText(t, limit.key, limit.package) })}
      dirty={
        override === null || stateOf(override) !== JSON.stringify([unlimited, value, reason, until])
      }
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
              remove.mutate(limit.key, {
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
            key: limit.key,
            value: unlimited ? null : amount,
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="override-value">{t("override.value")}</Label>
            <NumberField
              id="override-value"
              min={0}
              disabled={unlimited}
              {...(limit.key === "storage_mb" ? { suffix: "MB" } : {})}
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
              }}
            />
          </div>
          <div className="flex items-center gap-2 sm:pt-7">
            <Checkbox
              id="override-unlimited"
              checked={unlimited}
              onCheckedChange={(checked) => {
                setUnlimited(checked === true)
              }}
            />
            <Label htmlFor="override-unlimited" className="font-normal">
              {t("limits.unlimited")}
            </Label>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="override-reason">{t("override.reason")}</Label>
          <Textarea
            id="override-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-2 sm:max-w-56">
          <Label htmlFor="override-until">{t("override.until")}</Label>
          <Input
            id="override-until"
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
