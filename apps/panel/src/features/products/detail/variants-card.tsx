import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { useSaveVariants } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { VariantRow } from "./variant-row"
import { savedRows, variantEdits, variantsSchema } from "./variant-values"
import type { VariantValues } from "./variant-values"

/** Price, stock and preorder per variant, edited in place and saved together. */
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
  // Selling past stock needs the preorder flag; a variant already on can still be turned off
  const preorderOn = useFeature("stock.preorder")
  const preorder = preorderOn || variants.some((variant) => variant.allow_backorder)
  const saved = savedRows(variants, locationId)
  const form = useForm<VariantValues>({
    resolver: zodResolver(variantsSchema),
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })

  const submit = form.handleSubmit((values) => {
    save.mutate(
      {
        edits: variantEdits(variants, values, form.formState.dirtyFields.rows, locationId),
        locationId,
      },
      {
        onSuccess: () => {
          form.reset(values)
          toast.success(t("products.detail.variantsSaved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  const head = "px-3 py-2 text-left text-xs font-medium text-muted-foreground"
  return (
    <CardForm
      title={t("products.detail.variants")}
      description={t(
        locationId ? "products.detail.variantsHint" : "products.detail.variantsNoLocation"
      )}
      {...(className ? { className } : {})}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
      }}
    >
      <div className="-mx-5 overflow-x-auto border-y">
        <table className={cn("w-full text-sm", preorder ? "min-w-[46rem]" : "min-w-[40rem]")}>
          <thead className="bg-muted/60">
            <tr>
              <th className={cn(head, "pl-5")}>{t("products.wizard.variant")}</th>
              <th className={cn(head, "w-36")}>{t("products.wizard.price")}</th>
              <th className={cn(head, "w-28")}>{t("products.wizard.stock")}</th>
              <th className={cn(head, "w-32 text-right", !preorder && "pr-5")}>
                {t("products.detail.reserved")}
              </th>
              {preorder ? (
                <th className={cn(head, "w-28 pr-5 text-right")}>
                  {t("products.detail.backorder")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <VariantRow
                key={variant.id}
                variant={variant}
                index={index}
                form={form}
                locationId={locationId}
                preorder={preorder}
                preorderOn={preorderOn}
              />
            ))}
          </tbody>
        </table>
      </div>
    </CardForm>
  )
}
