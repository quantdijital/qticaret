import { Button } from "@medusajs/ui"
import { Controller, useForm } from "react-hook-form"
import type { FieldNamesMarkedBoolean } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { CatalogBody, ProductCatalog } from "../../lib/catalog"
import { ConditionField, NO_CATEGORY, PrimaryCategoryField, VariantCodes } from "./catalog-fields"
import type { CatalogFormValues } from "./catalog-fields"
import { SuccessorPicker } from "./successor-picker"
import type { CatalogSave } from "./use-product-catalog"

const toForm = (catalog: ProductCatalog): CatalogFormValues => ({
  condition: catalog.condition,
  primary_category_id: catalog.primary_category_id ?? NO_CATEGORY,
  successor: catalog.successor,
  mpn: Object.fromEntries(catalog.variants.map((variant) => [variant.id, variant.mpn ?? ""])),
})

/**
 * Only what the user changed is sent: an untouched field keeps what is
 * stored, even an ID the form cannot show (a deleted successor). An emptied
 * MPN is cleared.
 */
function toBody(
  form: CatalogFormValues,
  dirty: Partial<Readonly<FieldNamesMarkedBoolean<CatalogFormValues>>>,
  catalog: ProductCatalog
): CatalogBody {
  const variants = Object.fromEntries(
    catalog.variants.flatMap((variant) => {
      const mpn = (form.mpn[variant.id] ?? "").trim()
      return mpn === (variant.mpn ?? "") ? [] : [[variant.id, { mpn: mpn === "" ? null : mpn }]]
    })
  )
  const primary = form.primary_category_id
  return {
    ...(dirty.condition ? { condition: form.condition } : {}),
    ...(dirty.primary_category_id
      ? { primary_category_id: primary === NO_CATEGORY ? null : primary }
      : {}),
    ...(dirty.successor ? { successor_product_id: form.successor?.id ?? null } : {}),
    ...(Object.keys(variants).length > 0 ? { variants } : {}),
  }
}

interface CatalogFormProps {
  productId: string
  catalog: ProductCatalog
  save: CatalogSave
}

/** The catalog fields; mounted once they have loaded, so every field starts filled. */
export function CatalogForm({ productId, catalog, save }: CatalogFormProps) {
  const { t } = useTranslation()
  const form = useForm<CatalogFormValues>({ defaultValues: toForm(catalog) })
  // Read while rendering: React Hook Form tracks only the form state read here
  const { dirtyFields, isDirty } = form.formState
  const submit = form.handleSubmit((values) => {
    save.mutate(toBody(values, dirtyFields, catalog))
  })

  return (
    <form
      className="flex flex-col gap-4 px-6 py-4"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ConditionField control={form.control} />
        <PrimaryCategoryField control={form.control} catalog={catalog} />
      </div>
      <Controller
        control={form.control}
        name="successor"
        render={({ field }) => (
          <SuccessorPicker productId={productId} value={field.value} onChange={field.onChange} />
        )}
      />
      <VariantCodes catalog={catalog} register={form.register} />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="small"
          variant="secondary"
          disabled={!isDirty || save.isPending}
          onClick={() => {
            form.reset()
          }}
        >
          {t("qticaret.common.reset")}
        </Button>
        <Button type="submit" size="small" disabled={!isDirty} isLoading={save.isPending}>
          {t("qticaret.common.save")}
        </Button>
      </div>
    </form>
  )
}
