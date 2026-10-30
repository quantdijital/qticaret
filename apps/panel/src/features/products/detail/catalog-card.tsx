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
import { Switch } from "@/components/ui/switch"
import {
  PRODUCT_CONDITIONS,
  PRODUCT_KINDS,
  productCatalogQuery,
  useSaveCatalog,
} from "@/features/products/api/product-edit"
import type {
  ProductCatalog,
  ProductCondition,
  ProductKind,
} from "@/features/products/api/product-edit"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { CardForm } from "@/components/patterns/card-form"

// Radix Select has no empty value; this one stands for "none chosen"
const NONE = "__none__"

interface Values {
  condition: ProductCondition
  kind: ProductKind
  primary_category_id: string
  withdrawal_excluded: boolean
}

function CatalogForm({ productId, catalog }: { productId: string; catalog: ProductCatalog }) {
  const { t } = useTranslation()
  const save = useSaveCatalog(productId)
  // The kind shows once the shop sells digital or service products, or this one is one
  const kinds = useFeature("catalog.non_physical") || catalog.kind !== "physical"
  const saved: Values = {
    condition: catalog.condition,
    kind: catalog.kind,
    primary_category_id: catalog.primary_category_id ?? "",
    withdrawal_excluded: catalog.withdrawal_excluded,
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const { dirtyFields } = form.formState

  // Only what changed is sent; the audit log shows those fields (F3.1)
  const submit = form.handleSubmit((values) => {
    save.mutate(
      {
        ...(dirtyFields.condition ? { condition: values.condition } : {}),
        ...(dirtyFields.kind ? { kind: values.kind } : {}),
        ...(dirtyFields.primary_category_id
          ? { primary_category_id: values.primary_category_id || null }
          : {}),
        ...(dirtyFields.withdrawal_excluded
          ? { withdrawal_excluded: values.withdrawal_excluded }
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
      {kinds ? (
        <Field
          label={t("products.catalog.kind")}
          htmlFor="catalog-kind"
          hint={t("products.catalog.kindHint")}
        >
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="catalog-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`products.catalog.kinds.${kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      ) : null}
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
      <div className="flex items-start justify-between gap-4 border-t pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="catalog-withdrawal" className="text-sm font-medium">
            {t("products.catalog.withdrawalExcluded")}
          </label>
          <span id="catalog-withdrawal-hint" className="text-[13px] text-muted-foreground">
            {t("products.catalog.withdrawalExcludedHint")}
          </span>
        </div>
        <Controller
          control={form.control}
          name="withdrawal_excluded"
          render={({ field }) => (
            <Switch
              id="catalog-withdrawal"
              aria-describedby="catalog-withdrawal-hint"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </CardForm>
  )
}

/**
 * Condition and primary category, the fields search results and feeds read
 * (F3.1), and whether the product is outside the right of withdrawal (F13.4).
 */
export function CatalogCard({ productId }: { productId: string }) {
  const catalog = useQuery(productCatalogQuery(productId))
  if (!catalog.data) {
    return <Skeleton className="h-56 w-full rounded-lg" />
  }
  return <CatalogForm productId={productId} catalog={catalog.data} />
}
