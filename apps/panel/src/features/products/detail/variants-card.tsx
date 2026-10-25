import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { useSaveVariants } from "@/features/products/api/product-edit"
import type { VariantEdit } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"
import { cn } from "@/lib/utils"
import { CardForm } from "./card-form"

const CURRENCY = "try"

const rowSchema = z.object({
  price: z
    .string()
    .refine((text) => (parseMoneyInput(text) ?? 0) > 0, { message: "products.errors.price" }),
  stock: z.string().refine((text) => /^\d+$/.test(text.trim()) && Number(text) <= 1_000_000, {
    message: "products.errors.stock",
  }),
})
const schema = z.object({ rows: z.array(rowSchema) })
type Values = z.infer<typeof schema>

type Variant = NonNullable<ProductDetail["variants"]>[number]

/** The variant's level at the shop's default location: what is on the shelf, what is held for orders. */
function levelAt(variant: Variant, locationId: string | null) {
  const item = variant.inventory_items?.[0]
  const level = item?.inventory?.location_levels?.find((row) => row.location_id === locationId)
  return {
    inventoryItemId: item?.inventory_item_id ?? null,
    stocked: level?.stocked_quantity ?? 0,
    reserved: level?.reserved_quantity ?? 0,
    hasLevel: Boolean(level),
  }
}

const tryPrice = (variant: Variant) =>
  variant.prices?.find((price) => price.currency_code === CURRENCY)?.amount

/** Price and stock per variant, edited in place and saved together. */
export function VariantsCard({
  product,
  className,
}: {
  product: ProductDetail
  className?: string
}) {
  const { t } = useTranslation()
  const defaults = useQuery(shopDefaultsQuery())
  const locationId = defaults.data?.locationId ?? null
  const save = useSaveVariants(product.id)
  const variants = [...(product.variants ?? [])].sort(
    (a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
  )
  const saved: Values = {
    rows: variants.map((variant) => {
      const amount = tryPrice(variant)
      return {
        price: typeof amount === "number" ? formatMoneyInput(amount) : "",
        stock: String(levelAt(variant, locationId).stocked),
      }
    }),
  }
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isDirty, dirtyFields } = form.formState

  const submit = form.handleSubmit((values) => {
    const edits: VariantEdit[] = variants.flatMap((variant, index) => {
      const row = values.rows[index]
      if (!row || !dirtyFields.rows?.[index]) {
        return []
      }
      const level = levelAt(variant, locationId)
      return [
        {
          variantId: variant.id,
          prices: (variant.prices ?? []).map(({ id, currency_code, amount }) => ({
            id,
            currency_code,
            amount,
          })),
          amount: parseMoneyInput(row.price) ?? 0,
          stock:
            variant.manage_inventory && level.inventoryItemId
              ? {
                  inventoryItemId: level.inventoryItemId,
                  quantity: Number(row.stock),
                  hasLevel: level.hasLevel,
                }
              : null,
        },
      ]
    })
    save.mutate(
      { edits, locationId },
      {
        onSuccess: () => toast.success(t("products.detail.variantsSaved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  const head = "px-3 py-2 text-left text-xs font-medium text-muted-foreground"
  return (
    <CardForm
      title={t("products.detail.variants")}
      description={t("products.detail.variantsHint")}
      {...(className ? { className } : {})}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
      }}
    >
      <div className="-mx-5 overflow-x-auto border-y">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className={cn(head, "pl-5")}>{t("products.wizard.variant")}</th>
              <th className={cn(head, "w-36")}>{t("products.wizard.price")}</th>
              <th className={cn(head, "w-28")}>{t("products.wizard.stock")}</th>
              <th className={cn(head, "w-32 pr-5 text-right")}>{t("products.detail.reserved")}</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const level = levelAt(variant, locationId)
              const rowErrors = errors.rows?.[index]
              const error = rowErrors?.price?.message ?? rowErrors?.stock?.message
              return (
                <tr key={variant.id} className="border-t align-top">
                  <td className="py-2 pr-3 pl-5">
                    <div className="flex flex-col gap-0.5 pt-1.5">
                      <span className="font-medium">{variant.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {variant.sku ?? "—"}
                      </span>
                      {error ? (
                        <span role="alert" className="text-xs text-destructive-text">
                          {t(error)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative">
                      <Input
                        inputMode="decimal"
                        aria-label={`${variant.title ?? ""} ${t("products.wizard.price")}`}
                        className="pr-7 text-right tabular-nums"
                        {...form.register(`rows.${index}.price`)}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                        ₺
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {variant.manage_inventory ? (
                      <Input
                        inputMode="numeric"
                        aria-label={`${variant.title ?? ""} ${t("products.wizard.stock")}`}
                        className="tabular-nums"
                        {...form.register(`rows.${index}.stock`)}
                      />
                    ) : (
                      <span className="block pt-2 text-xs text-muted-foreground">
                        {t("products.untracked")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-5 pl-3 text-right tabular-nums">
                    <span className="block pt-2 text-muted-foreground">
                      {variant.manage_inventory ? formatCount(level.reserved) : "—"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </CardForm>
  )
}
