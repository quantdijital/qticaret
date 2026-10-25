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

interface Values {
  category_ids: string[]
  type_id: string
}

/** Where the product is listed and which KDV group it is taxed in. */
export function OrganizeCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const saved: Values = {
    category_ids: (product.categories ?? []).map((category) => category.id),
    type_id: product.type?.id ?? "",
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })

  const submit = form.handleSubmit((values) => {
    update.mutate(
      { categories: values.category_ids.map((id) => ({ id })), type_id: values.type_id || null },
      {
        onSuccess: () => toast.success(t("products.detail.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  return (
    <CardForm
      title={t("products.wizard.organize")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
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
