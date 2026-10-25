import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { CategoryTree } from "@/features/products/components/category-tree"
import { VatSelect } from "@/features/products/components/vat-select"
import { errorText } from "@/lib/errors"
import { CardForm } from "@/components/patterns/card-form"
import { SearchPicker } from "@/components/patterns/search-picker"
import type { PickerOption } from "@/components/patterns/search-picker"
import { brandOptions, useSetProductBrand } from "@/features/brands/api/brands"

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

/** Where the product is listed, under which brand, and which KDV group it is taxed in. */
export function OrganizeCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const setBrand = useSetProductBrand(product.id)
  const saved: Values = {
    category_ids: (product.categories ?? []).map((category) => category.id),
    type_id: product.type?.id ?? "",
    brand: brandOf(product),
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })

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
      toast.success(t("products.detail.saved"))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <CardForm
      title={t("products.wizard.organize")}
      dirty={form.formState.isDirty}
      saving={update.isPending || setBrand.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
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
