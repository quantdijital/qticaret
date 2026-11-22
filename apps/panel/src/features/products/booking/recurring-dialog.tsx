import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { useCreateSlots } from "@/features/products/api/booking"
import { bookingFailureText } from "./booking-failure"
import { RECURRING_MAX, formatSlotStart, recurringStarts } from "./slot-dates"
import { BOOKING_LIMITS, recurringSchema } from "./slot-schemas"
import type { RecurringDraft } from "./slot-schemas"

const B = "products.booking.recurring"

// Monday first, as a Turkish calendar
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const

/**
 * Departures by a rule ("every Saturday at 09:00 from May to June, 20
 * places"): the dates are made here, shown as a count, and sent as one
 * list of at most 60.
 */
export function RecurringDialog({
  productId,
  zone,
  onClose,
}: {
  productId: string
  zone: string
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const create = useCreateSlots(productId)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<RecurringDraft>({
    resolver: zodResolver(recurringSchema(zone)),
    defaultValues: { from: "", to: "", weekdays: [], time: "09:00", capacity: "" },
  })
  const { errors } = form.formState
  const rule = useWatch({ control: form.control })
  const preview = recurringStarts({
    from: rule.from ?? "",
    to: rule.to ?? "",
    weekdays: (rule.weekdays ?? []).filter((day): day is number => typeof day === "number"),
    time: rule.time ?? "",
    zone,
  })
  const first = preview.starts[0]
  const last = preview.starts.at(-1)

  const submit = form.handleSubmit((draft) => {
    setFailure(null)
    const capacity = parseCountInput(draft.capacity) ?? 0
    const { starts } = recurringStarts({ ...draft, zone })
    create.mutate(
      starts.map((starts_at) => ({ starts_at, capacity })),
      {
        onSuccess: () => {
          toast.success(t("products.booking.slots.added", { count: starts.length }))
          onClose()
        },
        onError: (error) => {
          setFailure(bookingFailureText(t, error))
        },
      }
    )
  })
  const errorOf = (message: string | undefined) => (message ? t(message) : undefined)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${B}.title`)}
      description={t("products.booking.zoneNote", { zone })}
      dirty={form.formState.isDirty}
      saving={create.isPending}
      onSubmit={() => void submit()}
    >
      <DialogBody>
        <Field label={t(`${B}.weekdays`)} error={errorOf(errors.weekdays?.message)} required>
          <Controller
            control={form.control}
            name="weekdays"
            render={({ field }) => (
              <ToggleGroup
                type="multiple"
                variant="outline"
                aria-label={t(`${B}.weekdays`)}
                value={field.value.map(String)}
                onValueChange={(next) => {
                  field.onChange(next.map(Number))
                }}
              >
                {WEEK.map((day) => (
                  <ToggleGroupItem key={day} value={String(day)} className="flex-1">
                    {t(`${B}.days.${String(day)}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t(`${B}.time`)}
            htmlFor="recurring-time"
            error={errorOf(errors.time?.message)}
            required
          >
            <Input id="recurring-time" type="time" {...form.register("time")} />
          </Field>
          <Field
            label={t(`${B}.from`)}
            htmlFor="recurring-from"
            error={errorOf(errors.from?.message)}
            required
          >
            <Input id="recurring-from" type="date" {...form.register("from")} />
          </Field>
          <Field
            label={t(`${B}.to`)}
            htmlFor="recurring-to"
            error={errorOf(errors.to?.message)}
            required
          >
            <Input id="recurring-to" type="date" {...form.register("to")} />
          </Field>
        </div>
        <Field
          label={t("products.booking.capacity")}
          htmlFor="recurring-capacity"
          hint={t(`${B}.capacityHint`)}
          error={errorOf(errors.capacity?.message)}
          required
        >
          <NumberField
            id="recurring-capacity"
            min={1}
            max={BOOKING_LIMITS.capacity}
            suffix={t("products.booking.places")}
            aria-invalid={Boolean(errors.capacity)}
            {...form.register("capacity")}
          />
        </Field>
        <p aria-live="polite" className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {first && last
            ? t(`${B}.preview`, {
                count: preview.starts.length,
                first: formatSlotStart(first, zone, i18n.language),
                last: formatSlotStart(last, zone, i18n.language),
              })
            : t(`${B}.previewNone`)}
          {preview.more ? (
            <span className="mt-1 block text-warning-text">
              {t(`${B}.more`, { max: RECURRING_MAX })}
            </span>
          ) : null}
        </p>
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
