import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { PackageX } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { SectionFindings } from "@/features/content/section-findings"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { useStoreUnits } from "@/features/products/use-units"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { formatMeasureInput, parseMeasureInput } from "@/lib/money-input"
import { CardForm } from "@/components/patterns/card-form"
import { NumberField } from "@/components/patterns/number-field"
import { productFold } from "./sections"

const FIELDS = [
  { name: "weight", unit: "weight" },
  { name: "length", unit: "dimension" },
  { name: "width", unit: "dimension" },
  { name: "height", unit: "dimension" },
] as const

type Name = (typeof FIELDS)[number]["name"]

const measure = z
  .string()
  .trim()
  .refine((text) => text === "" || (parseMeasureInput(text) ?? 0) > 0, {
    message: "products.errors.measure",
  })
const schema = z.object({ weight: measure, length: measure, width: measure, height: measure })
type Values = z.infer<typeof schema>

const asText = (value: number | null | undefined) =>
  typeof value === "number" && value > 0 ? formatMeasureInput(value) : ""

const valuesOf = (product: Pick<ProductDetail, Name>): Values => ({
  weight: asText(product.weight),
  length: asText(product.length),
  width: asText(product.width),
  height: asText(product.height),
})

// What is saved in one line: "450 g · 30 × 10 × 5 cm"; none, the shop's default parcel
function parcelLine(
  t: TFunction,
  product: Pick<ProductDetail, Name>,
  units: { weight: string; dimension: string }
): string {
  const text = (value: number | null | undefined) => asText(value) || "—"
  const sizes = [product.length, product.width, product.height]
  const parts = [
    asText(product.weight) ? `${text(product.weight)} ${units.weight}` : undefined,
    sizes.some((value) => asText(value))
      ? `${sizes.map(text).join(" × ")} ${units.dimension}`
      : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : t("products.sections.defaultParcel")
}

/**
 * The parcel's weight and size at product level; variants without their
 * own take these. Optional, published or not (adr/0054): without them
 * shipping is priced by the shop's default parcel. With `fold`, folded
 * under the page's main parts to its measures, and not drawn for a
 * digital product or a service (nothing to measure).
 */
export function ShippingCard({
  product,
  fold,
}: {
  product: ProductDetail
  /** The advisor's findings for it: folded, counted in its line, an urgent one opens it. */
  fold?: SectionFindings
}) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const units = useStoreUnits()
  const catalog = useQuery(productCatalogQuery(product.id))
  const saved = valuesOf(product)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    const body = Object.fromEntries(
      FIELDS.map(({ name }) => [name, parseMeasureInput(values[name]) ?? null])
    ) as Record<Name, number | null>
    update.mutate(body, {
      onSuccess: (result) => {
        form.reset(valuesOf(result.product), FULL_RESET)
        toast.success(t("products.detail.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })

  if (fold && !catalog.data) {
    return <Skeleton className="h-14 rounded-lg" />
  }
  // F3.2: a digital or service product has no parcel to measure
  if (fold && catalog.data?.kind !== "physical") {
    return null
  }
  if (catalog.data && catalog.data.kind !== "physical") {
    return (
      <SectionCard title={t("products.wizard.shippingCard")}>
        <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <PackageX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`products.detail.noShipping.${catalog.data.kind}`)}
        </p>
      </SectionCard>
    )
  }

  return (
    <CardForm
      title={t("products.wizard.shippingCard")}
      description={t("products.detail.shippingHint")}
      collapse={
        fold &&
        productFold(
          t,
          "shipping",
          fold,
          [parcelLine(t, product, units)],
          // A measure the form refused: it opens to show it
          Object.keys(errors).length > 0
        )
      }
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map(({ name, unit }) => {
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
                {...form.register(name)}
              />
            </Field>
          )
        })}
      </div>
    </CardForm>
  )
}
