import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PRODUCT_CONDITIONS,
  productCatalogQuery,
  useSaveCatalog,
} from "@/features/products/api/product-edit"
import type { ProductCatalog, ProductCondition } from "@/features/products/api/product-edit"
import { errorText } from "@/lib/errors"
import { CardForm } from "@/components/patterns/card-form"

// Radix Select has no empty value; this one stands for "none chosen"
const NONE = "__none__"

interface Values {
  condition: ProductCondition
  primary_category_id: string
}

function CatalogForm({ productId, catalog }: { productId: string; catalog: ProductCatalog }) {
  const { t } = useTranslation()
  const save = useSaveCatalog(productId)
  const saved: Values = {
    condition: catalog.condition,
    primary_category_id: catalog.primary_category_id ?? "",
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const { dirtyFields } = form.formState

  // Only what changed is sent; the audit log shows those fields (F3.1)
  const submit = form.handleSubmit((values) => {
    save.mutate(
      {
        ...(dirtyFields.condition ? { condition: values.condition } : {}),
        ...(dirtyFields.primary_category_id
          ? { primary_category_id: values.primary_category_id || null }
          : {}),
      },
      {
        onSuccess: () => {
          form.reset(values)
          toast.success(t("products.detail.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  return (
    <CardForm
      title={t("products.catalog.card")}
      description={t("products.catalog.hint")}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
      }}
    >
      <Field label={t("products.catalog.condition")} htmlFor="catalog-condition">
        <Controller
          control={form.control}
          name="condition"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="catalog-condition" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {t(`products.catalog.conditions.${condition}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        label={t("products.catalog.primaryCategory")}
        htmlFor="catalog-primary"
        hint={t("products.catalog.primaryCategoryHint")}
      >
        <Controller
          control={form.control}
          name="primary_category_id"
          render={({ field }) => (
            <Select
              value={field.value || NONE}
              disabled={catalog.categories.length === 0}
              onValueChange={(next) => {
                field.onChange(next === NONE ? "" : next)
              }}
            >
              <SelectTrigger id="catalog-primary" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("products.catalog.noPrimary")}</SelectItem>
                {catalog.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    </CardForm>
  )
}

/** Condition and primary category, the fields search results and feeds read (F3.1). */
export function CatalogCard({ productId }: { productId: string }) {
  const catalog = useQuery(productCatalogQuery(productId))
  if (!catalog.data) {
    return <Skeleton className="h-56 w-full rounded-lg" />
  }
  return <CatalogForm productId={productId} catalog={catalog.data} />
}
