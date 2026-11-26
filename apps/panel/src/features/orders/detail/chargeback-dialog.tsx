import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { CHARGEBACK_REASONS, useOpenChargeback } from "@/features/orders/api/chargebacks"
import type { ChargebackReason, OpenChargebackBody } from "@/features/orders/api/chargebacks"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"

const C = "orders.chargeback"

const schema = z.object({
  amount: z.string().refine((text) => (parseMoneyInput(text) ?? 0) > 0, `${C}.amountInvalid`),
  reason: z.enum(CHARGEBACK_REASONS as [ChargebackReason, ...ChargebackReason[]]),
  reference: z.string().trim().max(100),
  due: z.string(),
  note: z.string().trim().max(1000),
})
type Values = z.infer<typeof schema>

/** The body the server takes: lira as typed, the deadline at the day's end in Turkey. */
const bodyOf = (orderId: string, values: Values): OpenChargebackBody => ({
  order_id: orderId,
  amount: parseMoneyInput(values.amount) ?? 0,
  reason: values.reason,
  ...(values.reference ? { provider_reference: values.reference } : {}),
  ...(values.due ? { due_at: new Date(`${values.due}T23:59:00+03:00`).toISOString() } : {}),
  ...(values.note ? { note: values.note } : {}),
})

function ChargebackFields({
  control,
  register,
  errors,
}: {
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
}) {
  const { t } = useTranslation()
  return (
    <DialogBody>
      <Field
        label={t(`${C}.amount`)}
        htmlFor="chargeback-amount"
        error={errors.amount?.message ? t(errors.amount.message) : undefined}
      >
        <NumberField
          id="chargeback-amount"
          decimals={2}
          min={0}
          suffix="₺"
          className="w-48"
          {...register("amount")}
        />
      </Field>
      <Field label={t(`${C}.reason`)} htmlFor="chargeback-reason">
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
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
          )}
        />
      </Field>
      <Field
        label={t(`${C}.reference`)}
        htmlFor="chargeback-reference"
        hint={t(`${C}.referenceHint`)}
      >
        <Input
          placeholder={t("orders.placeholders.chargebackReference")}
          id="chargeback-reference"
          maxLength={100}
          {...register("reference")}
        />
      </Field>
      <Field label={t(`${C}.due`)} htmlFor="chargeback-due">
        <Input id="chargeback-due" type="date" className="w-48" {...register("due")} />
      </Field>
      <Field label={t(`${C}.note`)} htmlFor="chargeback-note">
        <Textarea
          placeholder={t("orders.placeholders.chargebackNote")}
          id="chargeback-note"
          rows={3}
          maxLength={1000}
          {...register("note")}
        />
      </Field>
    </DialogBody>
  )
}

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
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: formatMoneyInput(Number(paid)),
      reason: "not_received",
      reference: "",
      due: "",
      note: "",
    },
  })
  const submit = form.handleSubmit((values) => {
    save.mutate(bodyOf(orderId, values), {
      onSuccess: () => {
        toast.success(t(`${C}.opened`))
        onOpenChange(false)
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${C}.title`, { number: displayId })}</DialogTitle>
          <DialogDescription>{t(`${C}.description`)}</DialogDescription>
        </DialogHeader>
        <ChargebackFields
          control={form.control}
          register={form.register}
          errors={form.formState.errors}
        />
        <DialogFooter>
          <Button
            variant="cancel"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => void submit()}>
            {t(`${C}.open`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
