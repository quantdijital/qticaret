import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { findingsNote } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { useStoreUnits } from "@/features/products/use-units"
import { errorText } from "@/lib/errors"
import { parseMeasureInput } from "@qticaret/admin-ui/lib/money-input"
import { MEASURES, measureSchema, measureText, sizesLine } from "./measures"
import type { MeasureName } from "./measures"
import { PRODUCT_SECTIONS } from "./sections"
import { SideCard } from "./side-card"
import { SideForm } from "./side-form"

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

function ParcelForm({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const units = useStoreUnits()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: valuesOf(product) })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    const body = Object.fromEntries(
      MEASURES.map(({ name }) => [name, parseMeasureInput(values[name]) ?? null])
    ) as Record<MeasureName, number | null>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(t("products.detail.saved"))
        onClose()
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })

  return (
    <SideForm
      label={t("products.wizard.shippingCard")}
      hint={t("products.detail.shippingHint")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      {/* Two to a row where the card is wide enough for the fields' +/− buttons */}
      <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
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
    </SideForm>
  )
}

/**
 * The parcel's weight and size at product level, in the page's narrow
 * column: variants without their own take these. Optional, published or
 * not (adr/0054): without them shipping is priced by the shop's default
 * parcel. Not drawn for a digital product or a service (nothing to
 * measure). "Düzenle" and the advisor's "Alana git" turn the card into its form.
 */
export function ShippingCard({
  product,
  findings,
}: {
  product: ProductDetail
  /** The advisor's findings for it, counted under its facts. */
  findings?: SectionFindings
}) {
  const { t } = useTranslation()
  const units = useStoreUnits()
  const catalog = useQuery(productCatalogQuery(product.id))
  const [editing, setEditing] = useState(false)
  useRevealTarget(PRODUCT_SECTIONS.shipping, () => {
    setEditing(true)
  })
  if (!catalog.data) {
    return <Skeleton className="h-32 rounded-lg" />
  }
  // F3.2: a digital or service product has no parcel to measure
  if (catalog.data.kind !== "physical") {
    return null
  }
  const weight = measureText(product.weight)
  const sizes = sizesLine(product, units.dimension)
  const entered = Boolean(weight || sizes)
  return (
    <SideCard
      id={PRODUCT_SECTIONS.shipping}
      title={t("products.wizard.shippingCard")}
      rows={[
        {
          label: t("products.wizard.measures.weight"),
          value: weight ? `${weight} ${units.weight}` : "—",
          empty: !weight,
        },
        { label: t("products.side.sizes"), value: sizes ?? "—", empty: !sizes },
      ]}
      note={entered ? undefined : t("products.sections.defaultParcel")}
      findings={findings && findingsNote(t, findings)}
      editing={editing}
      onEdit={() => {
        setEditing(true)
      }}
    >
      <ParcelForm
        product={product}
        onClose={() => {
          setEditing(false)
        }}
      />
    </SideCard>
  )
}
