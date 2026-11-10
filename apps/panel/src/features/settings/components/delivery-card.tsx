import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { MarketingSettings, ShippingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const S = "settings.shipping.rules"

/** Hours a shop may promise same-day dispatch until. */
const CUTOFF_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const
const NONE = "none"

const dayCount = z.string().refine((text) => /^\d{1,2}$/.test(text.trim()), `${S}.daysInvalid`)

const schema = z
  .object({
    handling_days_min: dayCount,
    handling_days_max: dayCount,
    transit_days_min: dayCount,
    transit_days_max: dayCount,
    cutoff: z.string(),
  })
  .superRefine((values, ctx) => {
    for (const kind of ["handling", "transit"] as const) {
      if (Number(values[`${kind}_days_min`]) > Number(values[`${kind}_days_max`])) {
        ctx.addIssue({ code: "custom", path: [`${kind}_days_max`], message: `${S}.daysOrder` })
      }
    }
  })
type Values = z.infer<typeof schema>

/**
 * The form's values. The same-day hour is Kargo's; a shop that set it under
 * the feed rules before it moved (adr/0046 Ek 2026-11-06) sees that one
 * until it saves here.
 */
const valuesOf = (saved: ShippingSettings, legacy: number | null): Values => {
  const hour = saved.same_day_cutoff_hour ?? legacy
  return {
    handling_days_min: String(saved.handling_days_min),
    handling_days_max: String(saved.handling_days_max),
    transit_days_min: String(saved.transit_days_min),
    transit_days_max: String(saved.transit_days_max),
    cutoff: hour === null ? NONE : String(hour),
  }
}

/**
 * How long an order takes to leave and to arrive, and the hour until which
 * it leaves the same day: the product page's "Kargo ve Teslimat" card, the
 * products' shipping details and Akakçe say them.
 */
export function DeliveryCard({ saved }: { saved: ShippingSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<ShippingSettings>("shipping")
  const marketing = useQuery(sectionQuery<MarketingSettings>("marketing"))
  const clearLegacy = useSaveSection<MarketingSettings>("marketing")
  const legacy = marketing.data?.values.feed_same_day_cutoff_hour ?? null
  const values = valuesOf(saved, legacy)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    save.mutate(
      {
        handling_days_min: Number(next.handling_days_min),
        handling_days_max: Number(next.handling_days_max),
        transit_days_min: Number(next.transit_days_min),
        transit_days_max: Number(next.transit_days_max),
        same_day_cutoff_hour: next.cutoff === NONE ? null : Number(next.cutoff),
      },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values, null), FULL_RESET)
          toast.success(t("settings.saved"))
          // The hour lives here now: the old one under the feed rules no longer stands in
          if (legacy !== null) {
            clearLegacy.mutate(
              { feed_same_day_cutoff_hour: null },
              { onError: (failure) => toast.error(errorText(t, failure)) }
            )
          }
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const pair = (kind: "handling" | "transit") => {
    const error = errors[`${kind}_days_min`]?.message ?? errors[`${kind}_days_max`]?.message
    return (
      <Field
        label={t(`${S}.${kind}`)}
        htmlFor={`shipping-${kind}-min`}
        hint={t(`${S}.${kind}Hint`)}
        error={error ? t(error) : undefined}
      >
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <NumberField
            min={0}
            max={99}
            id={`shipping-${kind}-min`}
            aria-label={t(`${S}.min`)}
            className="w-36"
            {...form.register(`${kind}_days_min`)}
          />
          –
          <NumberField
            min={0}
            max={99}
            aria-label={t(`${S}.max`)}
            className="w-36"
            {...form.register(`${kind}_days_max`)}
          />
          {t(`${S}.days`)}
        </span>
      </Field>
    )
  }
  return (
    <CardForm
      title={t(`${S}.deliveryTitle`)}
      description={t(`${S}.deliveryDescription`)}
      dirty={form.formState.isDirty}
      saving={save.isPending || clearLegacy.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {pair("handling")}
      {pair("transit")}
      <Field label={t(`${S}.cutoff`)} htmlFor="shipping-cutoff" hint={t(`${S}.cutoffHint`)}>
        <Controller
          control={form.control}
          name="cutoff"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="shipping-cutoff" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t(`${S}.noCutoff`)}</SelectItem>
                {CUTOFF_HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {t(`${S}.until`, { hour: `${String(hour)}:00` })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    </CardForm>
  )
}
