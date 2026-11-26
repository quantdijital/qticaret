import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { parseMeasureInput } from "@qticaret/admin-ui/lib/money-input"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { useStoreUnits } from "@/features/products/use-units"
import { errorText } from "@/lib/errors"
import { MEASURES, measureSchema, measureText } from "./measures"
import type { MeasureName } from "./measures"
import { PRODUCT_SECTIONS } from "./sections"
import { STANDARD_CLASS, useShippingClasses } from "./shipping-class"
import { ShippingClassField } from "./shipping-class-field"

const schema = z.object({
  weight: measureSchema,
  length: measureSchema,
  width: measureSchema,
  height: measureSchema,
  shipping_class: z.string(),
})
type Values = z.infer<typeof schema>

const valuesOf = (
  product: Pick<ProductDetail, MeasureName>,
  shippingClass: string | null | undefined
): Values => ({
  weight: measureText(product.weight),
  length: measureText(product.length),
  width: measureText(product.width),
  height: measureText(product.height),
  shipping_class: shippingClass ?? STANDARD_CLASS,
})

/**
 * The "Kargo" tab of the "Ürün verileri" card (docs/06 "Ürün sayfası"):
 * the parcel's weight and size at product level, always as its form;
 * variants without their own take these. Optional, published or not
 * (adr/0054): without them shipping is priced by the shop's default
 * parcel. Not drawn for a digital product or a service (the card leaves
 * the tab out). The advisor's "Alana git" puts the caret in the weight.
 * Above them, the product's shipping class (adr/0087 §4), saved with the
 * same "Kaydet".
 */
export function ParcelPanel({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const saveCatalog = useSaveCatalog(product.id)
  const catalog = useQuery(productCatalogQuery(product.id)).data
  const classes = useShippingClasses()
  const units = useStoreUnits()
  const saved = valuesOf(product, catalog?.shipping_class)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState
  useRevealTarget(PRODUCT_SECTIONS.shipping, () => {
    document.getElementById("detail-weight")?.focus({ preventScroll: true })
  })
  const entered = MEASURES.some(({ name }) => Boolean(saved[name]))

  const submit = form.handleSubmit(async (values) => {
    const body = Object.fromEntries(
      MEASURES.map(({ name }) => [name, parseMeasureInput(values[name]) ?? null])
    ) as Record<MeasureName, number | null>
    const measuresChanged = MEASURES.some(({ name }) => values[name] !== saved[name])
    const classChanged = values.shipping_class !== saved.shipping_class
    try {
      if (classChanged) {
        await saveCatalog.mutateAsync({
          shipping_class: values.shipping_class === STANDARD_CLASS ? null : values.shipping_class,
        })
      }
      if (measuresChanged || !classChanged) {
        await update.mutateAsync(body)
      }
      form.reset(values, FULL_RESET)
      toast.success(t("products.detail.saved"))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <CardForm
      bare
      title={t("products.wizard.shippingCard")}
      dirty={form.formState.isDirty}
      saving={update.isPending || saveCatalog.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <p className="text-[13px] text-muted-foreground">
        {t("products.detail.shippingHint")}
        {entered ? null : ` ${t("products.sections.defaultParcel")}`}
      </p>
      <Controller
        control={form.control}
        name="shipping_class"
        render={({ field }) => (
          <ShippingClassField value={field.value} onChange={field.onChange} classes={classes} />
        )}
      />
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
