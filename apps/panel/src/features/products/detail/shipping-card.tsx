import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { PackageX } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Input } from "@/components/ui/input"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { useStoreUnits } from "@/features/products/use-units"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { formatMeasureInput, parseMeasureInput } from "@/lib/money-input"
import { CardForm } from "@/components/patterns/card-form"

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

/**
 * The parcel's weight and size at product level; variants without their
 * own take these. A published product cannot lose them (F3.1): the
 * server refuses, and the message says why.
 */
export function ShippingCard({ product }: { product: ProductDetail }) {
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

  // F3.2: a digital or service product has no parcel to measure
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
              <div className="relative">
                <Input
                  id={`detail-${name}`}
                  inputMode="decimal"
                  className="pr-10 tabular-nums"
                  {...form.register(name)}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                  {units[unit]}
                </span>
              </div>
            </Field>
          )
        })}
      </div>
    </CardForm>
  )
}
