import { CircleCheck, TriangleAlert } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Input } from "@/components/ui/input"
import { useStoreUnits } from "@/features/products/use-units"
import { parseMeasureInput } from "@/lib/money-input"
import { hasMeasures } from "../schema"
import type { WizardValues } from "../schema"

type Measure = "weight" | "length" | "width" | "height"

// Turkish carriers price by desi: length × width × height (cm) / 3000
const DESI_DIVISOR = 3000

function MeasureInput({ name, unit }: { name: Measure; unit: string }) {
  const { t } = useTranslation()
  const { register, formState } = useFormContext<WizardValues>()
  const error = formState.errors[name]?.message
  return (
    <Field
      label={t(`products.wizard.measures.${name}`)}
      htmlFor={`measure-${name}`}
      error={error ? t(error) : undefined}
    >
      <div className="relative">
        <Input
          id={`measure-${name}`}
          inputMode="decimal"
          className="pr-10 tabular-nums"
          {...register(name)}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
    </Field>
  )
}

/** Step 4: what the parcel weighs and measures, so carriers can price it. */
export function ShippingStep() {
  const { t } = useTranslation()
  const { control, getValues } = useFormContext<WizardValues>()
  const units = useStoreUnits()
  const [length, width, height] = useWatch({ control, name: ["length", "width", "height"] })
  useWatch({ control, name: "weight" })
  const ready = hasMeasures(getValues())
  // Desi is reckoned in centimetres
  const toCm = units.dimension === "mm" ? 0.1 : 1
  const sides = [length, width, height].map((text) => (parseMeasureInput(text) ?? 0) * toCm)
  const desi = sides.every((side) => side > 0)
    ? sides.reduce((product, side) => product * side, 1) / DESI_DIVISOR
    : null

  return (
    <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
      <SectionCard
        title={t("products.wizard.shippingCard")}
        description={t("products.wizard.shippingHint")}
        className="xl:col-span-8"
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MeasureInput name="weight" unit={units.weight} />
            <MeasureInput name="length" unit={units.dimension} />
            <MeasureInput name="width" unit={units.dimension} />
            <MeasureInput name="height" unit={units.dimension} />
          </div>
          <p className="text-xs text-muted-foreground">{t("products.wizard.measuresPackaged")}</p>
        </div>
      </SectionCard>
      <SectionCard title={t("products.wizard.shippingSummary")} className="xl:col-span-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t("products.wizard.desi")}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {desi === null
                ? "—"
                : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(desi)}
            </span>
          </div>
          {ready ? (
            <p className="flex items-start gap-2 text-sm text-success-text">
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              {t("products.wizard.measuresReady")}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-warning-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {t("products.wizard.measuresMissing")}
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
