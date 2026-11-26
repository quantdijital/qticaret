import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import type { CollapseOptions } from "@qticaret/admin-ui/patterns/collapsible-section"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useSaveSection } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import {
  formatMoneyInput,
  parseDecimalInput,
  parseMoneyInput,
} from "@qticaret/admin-ui/lib/money-input"

const S = "settings.shipping.rules"

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
export function RatesCard({
  saved,
  collapse,
}: {
  saved: ShippingSettings
  /** Folded under the page's "Gelişmiş" to a one-line summary. */
  collapse?: CollapseOptions | undefined
}) {
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
        onSuccess: (result) => {
          form.reset(ratesOf(result.values), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${S}.ratesTitle`)}
      collapse={collapse}
      description={t(`${S}.ratesDescription`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
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
              <NumberField
                decimals={1}
                min={0}
                aria-label={t(`${S}.maxDesi`, { number: index + 1 })}
                aria-invalid={Boolean(errors.rows?.[index]?.max_desi)}
                className="w-32"
                {...form.register(`rows.${index}.max_desi`)}
              />
              {t(`${S}.desi`)}
              <NumberField
                decimals={2}
                min={0}
                suffix="₺"
                aria-label={t(`${S}.priceOf`, { number: index + 1 })}
                aria-invalid={Boolean(errors.rows?.[index]?.price)}
                className="w-40"
                {...form.register(`rows.${index}.price`)}
              />
              <Button
                type="button"
                size="icon"
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
        <NumberField
          decimals={2}
          min={0}
          id="shipping-over-desi"
          className="w-40"
          {...form.register("over")}
        />
      </Field>
    </CardForm>
  )
}
