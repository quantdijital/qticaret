import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { parseMeasureInput } from "@qticaret/admin-ui/lib/money-input"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { useStoreUnits } from "@/features/products/use-units"
import { errorText } from "@/lib/errors"
import { MEASURES, measureSchema, measureText } from "./measures"
import type { MeasureName } from "./measures"
import { PRODUCT_SECTIONS } from "./sections"

const schema = z.object({
  weight: measureSchema,
  length: measureSchema,
  width: measureSchema,
  height: measureSchema,
})
type Values = z.infer<typeof schema>

const valuesOf = (product: Pick<ProductDetail, MeasureName>): Values => ({
  weight: measureText(product.weight),
  length: measureText(product.length),
  width: measureText(product.width),
  height: measureText(product.height),
})

/**
 * The "Kargo" tab of the "Ürün verileri" card (docs/06 "Ürün sayfası"):
 * the parcel's weight and size at product level, always as its form;
 * variants without their own take these. Optional, published or not
 * (adr/0054): without them shipping is priced by the shop's default
 * parcel. Not drawn for a digital product or a service (the card leaves
 * the tab out). The advisor's "Alana git" puts the caret in the weight.
 */
export function ParcelPanel({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const units = useStoreUnits()
  const saved = valuesOf(product)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState
  useRevealTarget(PRODUCT_SECTIONS.shipping, () => {
    document.getElementById("detail-weight")?.focus({ preventScroll: true })
  })
  const entered = Object.values(saved).some(Boolean)

  const submit = form.handleSubmit((values) => {
    const body = Object.fromEntries(
      MEASURES.map(({ name }) => [name, parseMeasureInput(values[name]) ?? null])
    ) as Record<MeasureName, number | null>
    update.mutate(body, {
      onSuccess: () => {
        form.reset(values, FULL_RESET)
        toast.success(t("products.detail.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })

  return (
    <CardForm
      bare
      title={t("products.wizard.shippingCard")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <p className="text-[13px] text-muted-foreground">
        {t("products.detail.shippingHint")}
        {entered ? null : ` ${t("products.sections.defaultParcel")}`}
      </p>
      {/* Two to a row where the panel is wide enough for the fields' +/− buttons */}
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        {MEASURES.map(({ name, unit }) => {
          const error = errors[name]?.message
          return (
            <Field
              key={name}
              label={t(`products.wizard.measures.${name}`)}
              htmlFor={`detail-${name}`}
              error={error ? t(error) : undefined}
            >
              <NumberField
                decimals={3}
                min={0}
                suffix={units[unit]}
                id={`detail-${name}`}
                aria-invalid={Boolean(error)}
                {...form.register(name)}
              />
            </Field>
          )
        })}
      </div>
    </CardForm>
  )
}
