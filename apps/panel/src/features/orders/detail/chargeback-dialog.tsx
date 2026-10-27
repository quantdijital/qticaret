import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CHARGEBACK_REASONS, useOpenChargeback } from "@/features/orders/api/chargebacks"
import type { ChargebackReason } from "@/features/orders/api/chargebacks"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"

const C = "orders.chargeback"

/**
 * Records a dispute from the provider's notice (F6.7, adr/0030): how much,
 * why, the provider's reference and by when it wants the evidence.
 */
export function ChargebackDialog({
  orderId,
  displayId,
  paid,
  open,
  onOpenChange,
}: {
  orderId: string
  displayId: number
  /** Lira the order paid, as Medusa writes it. */
  paid: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const save = useOpenChargeback()
  const [amount, setAmount] = useState(formatMoneyInput(Number(paid)))
  const [reason, setReason] = useState<ChargebackReason>("not_received")
  const [reference, setReference] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [note, setNote] = useState("")
  const parsed = parseMoneyInput(amount)
  const submit = () => {
    if (parsed === null || parsed <= 0) {
      return
    }
    save.mutate(
      {
        order_id: orderId,
        amount: parsed,
        reason,
        ...(reference.trim() ? { provider_reference: reference.trim() } : {}),
        // The day's end in Turkey, as the provider's deadline is read
        ...(dueDate ? { due_at: new Date(`${dueDate}T23:59:00+03:00`).toISOString() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t(`${C}.opened`))
          onOpenChange(false)
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${C}.title`, { number: displayId })}</DialogTitle>
          <DialogDescription>{t(`${C}.description`)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field
            label={t(`${C}.amount`)}
            htmlFor="chargeback-amount"
            error={parsed === null ? t(`${C}.amountInvalid`) : undefined}
          >
            <Input
              id="chargeback-amount"
              inputMode="decimal"
              className="w-40"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
              }}
            />
          </Field>
          <Field label={t(`${C}.reason`)} htmlFor="chargeback-reason">
            <Select
              value={reason}
              onValueChange={(next) => {
                setReason(next as ChargebackReason)
              }}
            >
              <SelectTrigger id="chargeback-reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHARGEBACK_REASONS.map((each) => (
                  <SelectItem key={each} value={each}>
                    {t(`${C}.reasons.${each}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t(`${C}.reference`)}
            htmlFor="chargeback-reference"
            hint={t(`${C}.referenceHint`)}
          >
            <Input
              id="chargeback-reference"
              value={reference}
              maxLength={100}
              onChange={(event) => {
                setReference(event.target.value)
              }}
            />
          </Field>
          <Field label={t(`${C}.due`)} htmlFor="chargeback-due">
            <Input
              id="chargeback-due"
              type="date"
              className="w-48"
              value={dueDate}
              onChange={(event) => {
                setDueDate(event.target.value)
              }}
            />
          </Field>
          <Field label={t(`${C}.note`)} htmlFor="chargeback-note">
            <Textarea
              id="chargeback-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
              }}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button disabled={parsed === null || parsed <= 0 || save.isPending} onClick={submit}>
            {t(`${C}.open`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
