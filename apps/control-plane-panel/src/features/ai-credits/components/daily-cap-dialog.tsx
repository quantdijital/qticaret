import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useSetDailyCap } from "@/features/ai-credits/api/mutations"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

// The control plane's DAILY_CAP_MAX
export const DAILY_CAP_MAX = 1_000_000

/**
 * "Günlük tavanı değiştir" (adr/0085 K7): the shop's own day's cap, or
 * empty for the platform's. Behind a step-up.
 */
export function DailyCapDialog({
  tenantId,
  ownCap,
  platformCap,
  onClose,
}: {
  tenantId: string
  ownCap: number | null
  platformCap: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const change = useSetDailyCap(tenantId)
  const [text, setText] = useState(ownCap === null ? "" : String(ownCap))
  const [failure, setFailure] = useState<string | null>(null)
  const blank = text.trim() === ""
  const value = blank ? null : parseCountInput(text)
  const ready = blank || (value !== null && value <= DAILY_CAP_MAX)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("aiCredits.dailyCap.title")}
      description={t("aiCredits.dailyCap.text", { cap: formatCount(platformCap) })}
      dirty={value !== ownCap}
      saving={change.isPending}
      canSubmit={ready}
      onSubmit={() => {
        if (!ready) {
          return
        }
        setFailure(null)
        change.mutate(value, {
          onSuccess: () => {
            toast.success(t("aiCredits.dailyCap.done"))
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="daily-cap">{t("aiCredits.dailyCap.label")}</Label>
          <NumberField
            id="daily-cap"
            min={0}
            max={DAILY_CAP_MAX}
            suffix={t("aiCredits.unit")}
            placeholder={formatCount(platformCap)}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("aiCredits.dailyCap.help")}</p>
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
