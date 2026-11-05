import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import type { SectionFindings } from "@/features/content/section-findings"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { CategoryTree } from "@/features/products/components/category-tree"
import { VatSelect } from "@/features/products/components/vat-select"
import { vatLabelOf, vatRatesQuery } from "@/features/settings/api/vat-rates"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { CardForm } from "@/components/patterns/card-form"
import { SearchPicker } from "@/components/patterns/search-picker"
import type { PickerOption } from "@/components/patterns/search-picker"
import { brandOptions, useSetProductBrand } from "@/features/brands/api/brands"
import { productFold, someNames } from "./sections"

interface Values {
  category_ids: string[]
  type_id: string
  brand: PickerOption | null
}

// The brand comes through a link (F3.11): Medusa's product type does not name it
const brandOf = (product: ProductDetail): PickerOption | null => {
  const brand = (product as { brand?: { id: string; name: string } | null }).brand
  return brand ? { id: brand.id, label: brand.name } : null
}

/**
 * Where the product is listed, under which brand, and which KDV group it
 * is taxed in. With `fold`, folded under the page's main parts to a line
 * of them ("N690 Çakılar · My L'arte · KDV %20").
 */
export function OrganizeCard({
  product,
  fold,
}: {
  product: ProductDetail
  /** The advisor's findings for it: folded, counted in its line, an urgent one opens it. */
  fold?: SectionFindings
}) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const setBrand = useSetProductBrand(product.id)
  const rates = useQuery(vatRatesQuery()).data
  const saved: Values = {
    category_ids: (product.categories ?? []).map((category) => category.id),
    type_id: product.type?.id ?? "",
    brand: brandOf(product),
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  // Closed, the line says what is saved (an edit not saved is said as such)
  const rate = saved.type_id
    ? rates?.rates.find((each) => each.product_type_id === saved.type_id)
    : rates?.default
  const categories = (product.categories ?? []).map((category) => category.name)

  const submit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState
    try {
      if (dirtyFields.category_ids || dirtyFields.type_id) {
        await update.mutateAsync({
          categories: values.category_ids.map((id) => ({ id })),
          type_id: values.type_id || null,
        })
      }
      if (dirtyFields.brand) {
        await setBrand.mutateAsync(values.brand?.id ?? null)
      }
      // Ids only: what was sent is what is stored
      form.reset(values, FULL_RESET)
      toast.success(t("products.detail.saved"))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <CardForm
      title={t("products.detail.organize")}
      collapse={
        fold &&
        productFold(t, "organize", fold, [
          categories.length > 0 ? someNames(categories) : t("products.sections.noCategory"),
          saved.brand?.label ?? t("products.sections.noBrand"),
          rate ? vatLabelOf(rate) : undefined,
        ])
      }
      dirty={form.formState.isDirty}
      saving={update.isPending || setBrand.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Field label={t("products.wizard.categories")} hint={t("products.wizard.categoriesHint")}>
        <Controller
          control={form.control}
          name="category_ids"
          render={({ field }) => <CategoryTree value={field.value} onChange={field.onChange} />}
        />
      </Field>
      <Field label={t("brands.field")} htmlFor="detail-brand" hint={t("brands.fieldHint")}>
        <Controller
          control={form.control}
          name="brand"
          render={({ field }) => (
            <SearchPicker
              id="detail-brand"
              value={field.value}
              onChange={field.onChange}
              search={brandOptions}
              queryKey={["brands", "options"]}
              placeholder={t("brands.pick")}
              empty={t("brands.noneFound")}
              inactiveNote={t("brands.inactive")}
            />
          )}
        />
      </Field>
      <Field
        label={t("products.wizard.vat")}
        htmlFor="detail-vat"
        hint={t("products.wizard.vatHint")}
      >
        <Controller
          control={form.control}
          name="type_id"
          render={({ field }) => (
            <VatSelect id="detail-vat" value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>
    </CardForm>
  )
}
