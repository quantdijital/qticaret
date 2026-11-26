import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { useSaveBookable } from "@/features/products/api/booking"
import type { Bookable } from "@/features/products/api/booking"
import { bookingFailureText } from "./booking-failure"
import type { VariantName } from "./slot-facts"
import { BOOKING_LIMITS, settingsDraftOf, settingsInputOf, settingsSchema } from "./slot-schemas"
import type { SettingsDraft } from "./slot-schemas"
import { SaleModeField } from "./sale-mode-field"
import { TravelerLevelField } from "./traveler-level-field"
import { CancelTiersField } from "./cancel-tiers-field"

const B = "products.booking.settings"

/**
 * The product's booking settings, the card's second plane (adr/0076 §3):
 * when sales close, how long a cart holds places, the most places in a
 * cart, the minimum group (for information) and how many places each
 * variant takes (an infant 0) with its ages, and what checkout asks of
 * each traveler (D6b), and the customer's cancellation tiers (D7a); first,
 * how it is sold: online, by a call-me request, or both (Ek 2026-11-23).
 */
export function BookingSettings({
  productId,
  bookable,
  variants,
}: {
  productId: string
  bookable: Bookable | null
  variants: readonly VariantName[]
}) {
  const { t } = useTranslation()
  const save = useSaveBookable(productId)
  const [failure, setFailure] = useState<string | null>(null)
  const values = settingsDraftOf(bookable, variants)
  const form = useForm<SettingsDraft>({
    resolver: zodResolver(settingsSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState
  const errorOf = (message: string | undefined) => (message ? t(message) : undefined)
  const submit = form.handleSubmit((draft) => {
    const settle = beginSave(form)
    setFailure(null)
    save.mutate(settingsInputOf(draft), {
      onSuccess: (answer) => {
        settle(settingsDraftOf(answer.bookable, variants))
        toast.success(t("products.detail.saved"))
      },
      onError: (error) => {
        setFailure(bookingFailureText(t, error))
      },
    })
  })
  const number = (
    name:
      "cutoff_hours" | "hold_minutes" | "max_units_per_cart" | "min_participants" | "reminder_days",
    min: number,
    max: number,
    suffix: string,
    placeholder?: string
  ) => (
    <Field
      label={t(`${B}.${name}`)}
      htmlFor={`booking-${name}`}
      hint={t(`${B}.${name}Hint`)}
      error={errorOf(errors[name]?.message)}
    >
      <NumberField
        id={`booking-${name}`}
        min={min}
        max={max}
        suffix={suffix}
        {...(placeholder ? { placeholder } : {})}
        aria-invalid={Boolean(errors[name])}
        {...form.register(name)}
      />
    </Field>
  )
  return (
    <CardForm
      bare
      title={t(`${B}.title`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        setFailure(null)
        form.reset(values, FULL_RESET)
      }}
    >
      <SaleModeField control={form.control} />
      <div className="grid gap-4 sm:grid-cols-2">
        {number("cutoff_hours", 0, BOOKING_LIMITS.cutoffHours, t(`${B}.hours`))}
        {number("hold_minutes", BOOKING_LIMITS.holdMin, BOOKING_LIMITS.holdMax, t(`${B}.minutes`))}
        {number("max_units_per_cart", 1, BOOKING_LIMITS.maxUnits, t("products.booking.places"))}
        {number(
          "min_participants",
          1,
          BOOKING_LIMITS.minParticipants,
          t("products.booking.places"),
          t(`${B}.none`)
        )}
        {number("reminder_days", 0, BOOKING_LIMITS.reminderDays, t(`${B}.days`))}
      </div>
      <div className="border-t pt-4">
        <TravelerLevelField control={form.control} />
      </div>
      <CancelTiersField control={form.control} register={form.register} errors={errors.tiers} />
      {variants.length > 0 ? (
        <fieldset className="flex flex-col gap-3 border-t pt-4">
          <legend className="text-sm font-medium">{t(`${B}.paxTitle`)}</legend>
          <p className="text-[13px] text-muted-foreground">{t(`${B}.paxHint`)}</p>
          {variants.map((variant) => {
            const entry = errors.pax?.[variant.id]
            const id = `booking-pax-${variant.id}`
            return (
              <div
                key={variant.id}
                className="grid items-start gap-3 sm:grid-cols-[1fr_repeat(3,7rem)]"
              >
                <span className="pt-2 text-sm">{variant.title}</span>
                <NumberField
                  id={id}
                  min={0}
                  max={BOOKING_LIMITS.pax}
                  aria-label={t(`${B}.paxOf`, { variant: variant.title })}
                  aria-invalid={Boolean(entry?.pax)}
                  {...form.register(`pax.${variant.id}.pax`)}
                />
                <NumberField
                  min={0}
                  max={BOOKING_LIMITS.age}
                  placeholder={t(`${B}.minAge`)}
                  aria-label={t(`${B}.minAgeOf`, { variant: variant.title })}
                  aria-invalid={Boolean(entry?.min_age)}
                  {...form.register(`pax.${variant.id}.min_age`)}
                />
                <NumberField
                  min={0}
                  max={BOOKING_LIMITS.age}
                  placeholder={t(`${B}.maxAge`)}
                  aria-label={t(`${B}.maxAgeOf`, { variant: variant.title })}
                  aria-invalid={Boolean(entry?.max_age)}
                  {...form.register(`pax.${variant.id}.max_age`)}
                />
                {entry ? (
                  <p role="alert" className="text-xs text-destructive-text sm:col-span-4">
                    {errorOf(
                      entry.pax?.message ?? entry.min_age?.message ?? entry.max_age?.message
                    )}
                  </p>
                ) : null}
              </div>
            )
          })}
        </fieldset>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-destructive-text">
          {failure}
        </p>
      ) : null}
    </CardForm>
  )
}
