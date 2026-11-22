import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useCreateSlots } from "@/features/products/api/booking"
import { bookingFailureText } from "./booking-failure"
import { zonedIso } from "./slot-dates"
import { BOOKING_LIMITS, slotDraftSchema } from "./slot-schemas"
import type { SlotDraft } from "./slot-schemas"

const B = "products.booking"

/** One departure: its start on the product's clock and its places. */
export function AddSlotDialog({
  productId,
  zone,
  onClose,
}: {
  productId: string
  zone: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateSlots(productId)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<SlotDraft>({
    resolver: zodResolver(slotDraftSchema(zone)),
    defaultValues: { starts_at: "", capacity: "" },
  })
  const { errors } = form.formState
  const submit = form.handleSubmit((draft) => {
    setFailure(null)
    create.mutate(
      [
        {
          starts_at: zonedIso(draft.starts_at, zone) ?? "",
          capacity: parseCountInput(draft.capacity) ?? 0,
        },
      ],
      {
        onSuccess: () => {
          toast.success(t(`${B}.slots.added`, { count: 1 }))
          onClose()
        },
        onError: (error) => {
          setFailure(bookingFailureText(t, error))
        },
      }
    )
  })
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${B}.add.title`)}
      description={t(`${B}.zoneNote`, { zone })}
      dirty={form.formState.isDirty}
      saving={create.isPending}
      onSubmit={() => void submit()}
    >
      <DialogBody>
        <Field
          label={t(`${B}.add.start`)}
          htmlFor="slot-start"
          error={errors.starts_at?.message && t(errors.starts_at.message)}
          required
        >
          <Input
            id="slot-start"
            type="datetime-local"
            aria-invalid={Boolean(errors.starts_at)}
            {...form.register("starts_at")}
          />
        </Field>
        <Field
          label={t(`${B}.capacity`)}
          htmlFor="slot-capacity"
          hint={t(`${B}.capacityHint`)}
          error={errors.capacity?.message && t(errors.capacity.message)}
          required
        >
          <NumberField
            id="slot-capacity"
            min={1}
            max={BOOKING_LIMITS.capacity}
            suffix={t(`${B}.places`)}
            aria-invalid={Boolean(errors.capacity)}
            {...form.register("capacity")}
          />
        </Field>
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
