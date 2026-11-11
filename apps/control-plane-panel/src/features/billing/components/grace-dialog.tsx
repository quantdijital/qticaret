import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useSetGrace } from "@/features/billing/api"
import type { Subscription } from "@/features/billing/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

/**
 * The shop's own grace days (adr/0061 §7 "mağaza istisnasıyla", Ek C16):
 * a number of days and the reason, or back to the package's. Behind a
 * step-up; it may restrict or free the shop at once.
 */
export function GraceDialog({
  tenantId,
  subscription,
  onClose,
}: {
  tenantId: string
  subscription: Subscription
  onClose: () => void
}) {
  const { t } = useTranslation()
  const change = useSetGrace(tenantId)
  const [own, setOwn] = useState(subscription.grace_days_override !== null)
  const [days, setDays] = useState(
    String(subscription.grace_days_override ?? subscription.grace_days)
  )
  const [reason, setReason] = useState(subscription.grace_override_reason ?? "")
  const [failure, setFailure] = useState<string | null>(null)
  const value = Number.parseInt(days, 10)
  const ready =
    !own || (Number.isInteger(value) && value >= 0 && value <= 90 && reason.trim().length >= 3)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("billing.grace.title")}
      description={t("billing.grace.text", { days: subscription.grace_days })}
      dirty
      saving={change.isPending}
      canSubmit={ready}
      submitLabel={t("common.save")}
      onSubmit={() => {
        setFailure(null)
        change.mutate(own ? { grace_days: value, reason: reason.trim() } : { grace_days: null }, {
          onSuccess: () => {
            toast.success(t("billing.grace.done"))
            onClose()
          },
          onError: (error) => {
            if (!isStepUpCancelled(error)) {
              setFailure(errorText(t, error))
            }
          },
        })
      }}
    >
      <DialogBody>
        <div className="flex items-center gap-2">
          <Checkbox
            id="grace-own"
            checked={own}
            onCheckedChange={(next) => {
              setOwn(next === true)
            }}
          />
          <Label htmlFor="grace-own" className="font-normal">
            {t("billing.grace.own")}
          </Label>
        </div>
        {own ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="grace-days">{t("billing.grace.days")}</Label>
              <NumberField
                id="grace-days"
                min={0}
                max={90}
                suffix={t("billing.days")}
                value={days}
                onChange={(event) => {
                  setDays(event.target.value)
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="grace-reason">{t("billing.charge.reason")}</Label>
              <Textarea
                id="grace-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                }}
              />
            </div>
          </>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
