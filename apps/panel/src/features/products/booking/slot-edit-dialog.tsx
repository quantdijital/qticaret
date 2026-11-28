import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
import { useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useUpdateSlot } from "@/features/products/api/booking"
import type { BookingSlot } from "@/features/products/api/booking"
import { bookingFailureText } from "./booking-failure"
import { formatSlotStart } from "./slot-dates"
import { minCapacityOf } from "./slot-facts"
import type { VariantName } from "./slot-facts"
import { BOOKING_LIMITS, adjustmentsOf, slotEditDraftOf, slotEditSchema } from "./slot-schemas"
import type { SlotEditDraft } from "./slot-schemas"

const B = "products.booking.edit"

/**
 * A departure's places and, as a further option, a difference on each
 * variant's price for it (in lira; the server prices the lines, adr/0076 §4).
 */
export function SlotEditDialog({
  productId,
  slot,
  zone,
  variants,
  onClose,
}: {
  productId: string
  slot: BookingSlot
  zone: string
  variants: readonly VariantName[]
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const update = useUpdateSlot(productId)
  const [failure, setFailure] = useState<string | null>(null)
  const minimum = minCapacityOf(slot)
  const pricesHintId = `${useId()}-prices`
  const [pricesOpen, setPricesOpen] = useState(Object.keys(slot.price_adjustments ?? {}).length > 0)
  const form = useForm<SlotEditDraft>({
    resolver: zodResolver(slotEditSchema(minimum)),
    defaultValues: slotEditDraftOf(slot),
  })
  const { errors, dirtyFields } = form.formState

  const submit = form.handleSubmit((draft) => {
    setFailure(null)
    update.mutate(
      {
        id: slot.id,
        changes: {
          ...(dirtyFields.capacity ? { capacity: parseCountInput(draft.capacity) ?? 0 } : {}),
          ...(dirtyFields.adjustments ? { price_adjustments: adjustmentsOf(draft) } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(t("products.detail.saved"))
          onClose()
        },
        onError: (error) => {
          setFailure(bookingFailureText(t, error))
        },
      }
    )
  })
  const capacityError = errors.capacity?.message
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${B}.title`)}
      description={formatSlotStart(slot.starts_at, zone, i18n.language)}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
    >
      <DialogBody>
        <Field
          label={t("products.booking.capacity")}
          htmlFor="slot-edit-capacity"
          hint={t(`${B}.capacityHint`, { count: minimum })}
          error={capacityError ? t(capacityError, { count: minimum }) : undefined}
          required
        >
          <NumberField
            id="slot-edit-capacity"
            min={minimum}
            max={BOOKING_LIMITS.capacity}
            suffix={t("products.booking.places")}
            aria-invalid={Boolean(capacityError)}
            {...form.register("capacity")}
          />
        </Field>
        {variants.length > 0 ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            {/* What the difference is, behind an (i) beside its toggle (the owner, 2026-11-28) */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={pricesOpen}
                aria-describedby={pricesHintId}
                onClick={() => {
                  setPricesOpen((open) => !open)
                }}
              >
                <ChevronDown className={cn("transition-transform", pricesOpen && "rotate-180")} />
                {t(`${B}.prices`)}
              </Button>
              <InfoTip name={t(`${B}.prices`)} hint={t(`${B}.pricesHint`)} hintId={pricesHintId} />
              <HiddenHint id={pricesHintId}>{t(`${B}.pricesHint`)}</HiddenHint>
            </div>
            {pricesOpen ? (
              <>
                {variants.map((variant) => {
                  const message = errors.adjustments?.[variant.id]?.message
                  return (
                    <Field
                      key={variant.id}
                      label={variant.title}
                      htmlFor={`slot-adjust-${variant.id}`}
                      error={message ? t(message) : undefined}
                    >
                      <Input
                        id={`slot-adjust-${variant.id}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        aria-invalid={Boolean(message)}
                        {...form.register(`adjustments.${variant.id}`)}
                      />
                    </Field>
                  )
                })}
              </>
            ) : null}
          </div>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
