import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useAdjust } from "@/features/ai-credits/api/mutations"
import type { AdjustInput } from "@/features/ai-credits/api/mutations"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

// The control plane's bounds (AI_CREDIT_MOVE_MAX, the note's 500)
const MOVE_MAX = 1_000_000
const NOTE_MAX = 500

type Sign = "add" | "take"
type Bucket = AdjustInput["bucket"]

function Choice<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (next: V) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-sm font-medium">
        {label}
      </p>
      <RadioGroup
        aria-labelledby={`${id}-label`}
        value={value}
        onValueChange={(next) => {
          onChange(next as V)
        }}
        className="flex flex-wrap gap-x-6 gap-y-2"
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${option.value}`} value={option.value} />
            <Label htmlFor={`${id}-${option.value}`} className="font-normal">
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

/**
 * "Kredi ekle / düş" (adr/0085 "Güvenlik"): which way, how many, which
 * bucket and why (required). The key is made once when the dialog opens
 * and sent with every try from it: a double click, or a retry after a
 * lost answer, writes the correction once (`applied: false` the second
 * time). Behind a step-up.
 */
export function AdjustDialog({
  tenantId,
  shopName,
  onClose,
}: {
  tenantId: string
  shopName: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const adjust = useAdjust(tenantId)
  const [key] = useState(() => crypto.randomUUID())
  const [sign, setSign] = useState<Sign>("add")
  const [bucket, setBucket] = useState<Bucket>("purchased")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const value = parseCountInput(amount)
  const ready = value !== null && value >= 1 && value <= MOVE_MAX && note.trim() !== ""
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("aiCredits.adjust.title")}
      description={t("aiCredits.adjust.text", { shop: shopName })}
      dirty
      saving={adjust.isPending}
      canSubmit={ready}
      submitLabel={t(`aiCredits.adjust.submit.${sign}`)}
      onSubmit={() => {
        if (!ready) {
          return
        }
        setFailure(null)
        adjust.mutate(
          { amount: sign === "add" ? value : -value, bucket, note: note.trim(), key },
          {
            onSuccess: (done) => {
              toast.success(
                done.applied ? t("aiCredits.adjust.done") : t("aiCredits.adjust.already")
              )
              onClose()
            },
            onError: (error) => {
              if (!isStepUpCancelled(error)) {
                setFailure(errorText(t, error))
              }
            },
          }
        )
      }}
    >
      <DialogBody>
        <Choice<Sign>
          id="adjust-sign"
          label={t("aiCredits.adjust.sign")}
          value={sign}
          onChange={setSign}
          options={[
            { value: "add", label: t("aiCredits.adjust.add") },
            { value: "take", label: t("aiCredits.adjust.take") },
          ]}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-amount">{t("aiCredits.adjust.amount")}</Label>
          <NumberField
            id="adjust-amount"
            min={1}
            max={MOVE_MAX}
            suffix={t("aiCredits.unit")}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value)
            }}
          />
          <p className="text-[13px] text-muted-foreground">
            {t("aiCredits.adjust.amountHelp", { max: formatCount(MOVE_MAX) })}
          </p>
        </div>
        <Choice<Bucket>
          id="adjust-bucket"
          label={t("aiCredits.adjust.bucket")}
          value={bucket}
          onChange={setBucket}
          options={[
            { value: "purchased", label: t("aiCredits.buckets.purchased") },
            { value: "plan", label: t("aiCredits.buckets.plan") },
          ]}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-note">{t("aiCredits.adjust.note")}</Label>
          <Textarea
            id="adjust-note"
            rows={3}
            maxLength={NOTE_MAX}
            required
            aria-required="true"
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("aiCredits.adjust.noteHelp")}</p>
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
