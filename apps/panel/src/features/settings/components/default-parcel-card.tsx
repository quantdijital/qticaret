import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { useStoreUnits } from "@/features/products/use-units"
import { PLATFORM_PARCEL, useSaveSection } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { formatMeasureInput, parseMeasureInput } from "@/lib/money-input"

const P = "settings.shipping.parcel"

const FIELDS = [
  { name: "weight", unit: "weight" },
  { name: "length", unit: "dimension" },
  { name: "width", unit: "dimension" },
  { name: "height", unit: "dimension" },
] as const

type Units = ReturnType<typeof useStoreUnits>

const measure = z.string().refine((text) => (parseMeasureInput(text) ?? 0) > 0, `${P}.invalid`)
const schema = z.object({ weight: measure, length: measure, width: measure, height: measure })
type Values = z.infer<typeof schema>

/** The shop's own parcel, else the platform's in the shop's units, as the four inputs show it. */
function valuesOf(saved: ShippingSettings, units: Units): Values {
  const side = (cm: number) => (units.dimension === "mm" ? cm * 10 : cm)
  const parcel = saved.default_parcel ?? {
    weight: units.weight === "kg" ? PLATFORM_PARCEL.weight_g / 1000 : PLATFORM_PARCEL.weight_g,
    length: side(PLATFORM_PARCEL.length_cm),
    width: side(PLATFORM_PARCEL.width_cm),
    height: side(PLATFORM_PARCEL.height_cm),
  }
  return {
    weight: formatMeasureInput(parcel.weight),
    length: formatMeasureInput(parcel.length),
    width: formatMeasureInput(parcel.width),
    height: formatMeasureInput(parcel.height),
  }
}

/** The desi a carrier counts: the larger of the kilograms and the volume (cm³) / 3000. */
function desiOf(values: Values, units: Units): number | null {
  const [weight, length, width, height] = FIELDS.map(({ name }) => parseMeasureInput(values[name]))
  if (!weight || !length || !width || !height) {
    return null
  }
  const cm = units.dimension === "mm" ? 0.1 : 1
  const kg = units.weight === "kg" ? weight : weight / 1000
  const volume = length * width * height * cm ** 3
  return Math.ceil(Math.max(kg, volume / 3000) * 10 - 1e-9) / 10
}

/**
 * Settings > Shipping: the parcel a product without weight or measures
 * ships as (adr/0054), in the shop's units. Shipping prices such a
 * product by it; the carrier measures the real parcel. Until the shop
 * saves its own, the platform's stands (1 kg, 30 × 20 × 10 cm, 2 desi).
 */
export function DefaultParcelCard({ saved }: { saved: ShippingSettings }) {
  const { t } = useTranslation()
  const units = useStoreUnits()
  const save = useSaveSection<ShippingSettings>("shipping")
  const values = valuesOf(saved, units)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const typed = useWatch({ control: form.control }) as Values
  const desi = desiOf({ ...values, ...typed }, units)
  const { errors } = form.formState
  const error = FIELDS.map(({ name }) => errors[name]?.message).find(Boolean)
  const submit = form.handleSubmit((next) => {
    save.mutate(
      {
        default_parcel: {
          weight: parseMeasureInput(next.weight) ?? 0,
          length: parseMeasureInput(next.length) ?? 0,
          width: parseMeasureInput(next.width) ?? 0,
          height: parseMeasureInput(next.height) ?? 0,
        },
      },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values, units), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${P}.title`)}
      description={t(`${P}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map(({ name, unit }) => (
          <Field key={name} label={t(`${P}.${name}`)} htmlFor={`default-parcel-${name}`}>
            <div className="relative">
              <Input
                id={`default-parcel-${name}`}
                inputMode="decimal"
                aria-invalid={Boolean(errors[name])}
                className="pr-10 tabular-nums"
                {...form.register(name)}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                {units[unit]}
              </span>
            </div>
          </Field>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive-text">
          {t(error)}
        </p>
      ) : null}
      <p className="text-[13px] text-muted-foreground">
        {desi === null
          ? t(`${P}.invalid`)
          : t(`${P}.desi`, {
              desi: new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(desi),
            })}
        {saved.default_parcel ? null : ` ${t(`${P}.platformDefault`)}`}
      </p>
    </CardForm>
  )
}
