import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSaveSection } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseDecimalInput, parseMoneyInput } from "@/lib/money-input"

const S = "settings.shipping.rules"

const dayCount = z.string().refine((text) => /^\d{1,2}$/.test(text.trim()), `${S}.daysInvalid`)

const daysSchema = z
  .object({
    handling_days_min: dayCount,
    handling_days_max: dayCount,
    transit_days_min: dayCount,
    transit_days_max: dayCount,
  })
  .superRefine((values, ctx) => {
    for (const kind of ["handling", "transit"] as const) {
      if (Number(values[`${kind}_days_min`]) > Number(values[`${kind}_days_max`])) {
        ctx.addIssue({ code: "custom", path: [`${kind}_days_max`], message: `${S}.daysOrder` })
      }
    }
  })
type DayValues = z.infer<typeof daysSchema>

const daysOf = (saved: ShippingSettings): DayValues => ({
  handling_days_min: String(saved.handling_days_min),
  handling_days_max: String(saved.handling_days_max),
  transit_days_min: String(saved.transit_days_min),
  transit_days_max: String(saved.transit_days_max),
})

/** How long an order takes to leave and to arrive: the shop's promise and its products' shipping details. */
export function DeliveryCard({ saved }: { saved: ShippingSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<ShippingSettings>("shipping")
  const values = daysOf(saved)
  const form = useForm<DayValues>({
    resolver: zodResolver(daysSchema),
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
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const pair = (kind: "handling" | "transit") => (
    <Field
      label={t(`${S}.${kind}`)}
      htmlFor={`shipping-${kind}-min`}
      hint={t(`${S}.${kind}Hint`)}
      error={
        (errors[`${kind}_days_min`]?.message ?? errors[`${kind}_days_max`]?.message)
          ? t(errors[`${kind}_days_min`]?.message ?? errors[`${kind}_days_max`]?.message ?? "")
          : undefined
      }
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Input
          id={`shipping-${kind}-min`}
          inputMode="numeric"
          aria-label={t(`${S}.min`)}
          className="w-20"
          {...form.register(`${kind}_days_min`)}
        />
        –
        <Input
          inputMode="numeric"
          aria-label={t(`${S}.max`)}
          className="w-20"
          {...form.register(`${kind}_days_max`)}
        />
        {t(`${S}.days`)}
      </span>
    </Field>
  )
  return (
    <CardForm
      title={t(`${S}.deliveryTitle`)}
      description={t(`${S}.deliveryDescription`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values)
      }}
    >
      {pair("handling")}
      {pair("transit")}
    </CardForm>
  )
}

const ratesSchema = z.object({
  rows: z
    .array(
      z.object({
        max_desi: z
          .string()
          .refine((text) => (parseDecimalInput(text, 1) ?? 0) > 0, `${S}.desiInvalid`),
        price: z.string().refine((text) => (parseMoneyInput(text) ?? -1) >= 0, `${S}.priceInvalid`),
      })
    )
    .max(20),
  over: z
    .string()
    .refine(
      (text) => text.trim() === "" || (parseMoneyInput(text) ?? -1) >= 0,
      `${S}.priceInvalid`
    ),
})
type RateValues = z.infer<typeof ratesSchema>

const ratesOf = (saved: ShippingSettings): RateValues => ({
  rows: saved.rate_table.map((row) => ({
    max_desi: formatMoneyInput(row.max_desi).replace(/,0+$/, ""),
    price: formatMoneyInput(row.price / 100),
  })),
  over: saved.over_desi_price > 0 ? formatMoneyInput(saved.over_desi_price / 100) : "",
})

/** The shop's own price by desi, for options priced by the table (F7.8). */
export function RatesCard({ saved }: { saved: ShippingSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<ShippingSettings>("shipping")
  const values = ratesOf(saved)
  const form = useForm<RateValues>({
    resolver: zodResolver(ratesSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const rows = useFieldArray({ control: form.control, name: "rows" })
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    save.mutate(
      {
        rate_table: next.rows.map((row) => ({
          max_desi: parseDecimalInput(row.max_desi, 1) ?? 0,
          price: Math.round((parseMoneyInput(row.price) ?? 0) * 100),
        })),
        over_desi_price:
          next.over.trim() === "" ? 0 : Math.round((parseMoneyInput(next.over) ?? 0) * 100),
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${S}.ratesTitle`)}
      description={t(`${S}.ratesDescription`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values)
      }}
    >
      {rows.fields.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${S}.noRates`)}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.fields.map((row, index) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
            >
              {t(`${S}.upTo`)}
              <Input
                inputMode="decimal"
                aria-label={t(`${S}.maxDesi`, { number: index + 1 })}
                aria-invalid={Boolean(errors.rows?.[index]?.max_desi)}
                className="w-20"
                {...form.register(`rows.${index}.max_desi`)}
              />
              {t(`${S}.desi`)}
              <Input
                inputMode="decimal"
                aria-label={t(`${S}.priceOf`, { number: index + 1 })}
                aria-invalid={Boolean(errors.rows?.[index]?.price)}
                className="w-28"
                {...form.register(`rows.${index}.price`)}
              />
              TL
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t(`${S}.removeRate`, { number: index + 1 })}
                onClick={() => {
                  rows.remove(index)
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={rows.fields.length >= 20}
          onClick={() => {
            rows.append({ max_desi: "", price: "" })
          }}
        >
          <Plus />
          {t(`${S}.addRate`)}
        </Button>
      </div>
      <Field
        label={t(`${S}.over`)}
        htmlFor="shipping-over-desi"
        hint={t(`${S}.overHint`)}
        error={errors.over?.message ? t(errors.over.message) : undefined}
      >
        <Input
          id="shipping-over-desi"
          inputMode="decimal"
          className="w-28"
          {...form.register("over")}
        />
      </Field>
    </CardForm>
  )
}
