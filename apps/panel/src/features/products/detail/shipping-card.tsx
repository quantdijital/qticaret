import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"
import { CardForm } from "./card-form"

const FIELDS = [
  { name: "weight", unit: "g" },
  { name: "length", unit: "cm" },
  { name: "width", unit: "cm" },
  { name: "height", unit: "cm" },
] as const

type Name = (typeof FIELDS)[number]["name"]

const measure = z
  .string()
  .trim()
  .refine((text) => text === "" || (parseMoneyInput(text) ?? 0) > 0, {
    message: "products.errors.measure",
  })
const schema = z.object({ weight: measure, length: measure, width: measure, height: measure })
type Values = z.infer<typeof schema>

const asText = (value: number | null | undefined) =>
  typeof value === "number" && value > 0 ? formatMoneyInput(value).replace(/,00$/, "") : ""

/**
 * The parcel's weight and size at product level; variants without their
 * own take these. A published product cannot lose them (F3.1): the
 * server refuses, and the message says why.
 */
export function ShippingCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const saved: Values = {
    weight: asText(product.weight),
    length: asText(product.length),
    width: asText(product.width),
    height: asText(product.height),
  }
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    const body = Object.fromEntries(
      FIELDS.map(({ name }) => [name, parseMoneyInput(values[name]) ?? null])
    ) as Record<Name, number | null>
    update.mutate(body, {
      onSuccess: () => toast.success(t("products.detail.saved")),
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })

  return (
    <CardForm
      title={t("products.wizard.shippingCard")}
      description={t("products.detail.shippingHint")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
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
                  {unit}
                </span>
              </div>
            </Field>
          )
        })}
      </div>
    </CardForm>
  )
}
