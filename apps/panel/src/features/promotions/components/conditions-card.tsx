import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { CategoryTree } from "@/features/products/components/category-tree"
import {
  collectionsQuery,
  productNamesQuery,
  searchProducts,
} from "@/features/promotions/api/scope-options"
import type { PromotionValues } from "@/features/promotions/form"
import type { Scope } from "@/features/promotions/scope"

const SCOPES: readonly Scope[] = ["all", "categories", "collections", "products"]

function CollectionList({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const { t } = useTranslation()
  const collections = useQuery(collectionsQuery())
  const rows = collections.data ?? []
  if (!collections.isPending && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("promotions.form.noCollections")}</p>
  }
  return (
    <ul
      // The shop's collections can be many: they scroll in a box of fixed height (e2e/support/scroll.ts)
      data-scroll-area="y"
      className="relative flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-md border p-1.5"
    >
      {rows.map((collection) => (
        <li key={collection.id}>
          <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox
              checked={value.includes(collection.id)}
              onCheckedChange={(checked) => {
                onChange(
                  checked === true
                    ? [...value, collection.id]
                    : value.filter((id) => id !== collection.id)
                )
              }}
            />
            {collection.title}
          </label>
        </li>
      ))}
    </ul>
  )
}

function ProductList({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation()
  const names = useQuery(productNamesQuery(value))
  const nameOf = (id: string) => names.data?.find((product) => product.id === id)?.title ?? id
  return (
    <div className="flex flex-col gap-3">
      <SearchPicker
        value={null}
        onChange={(picked) => {
          if (picked && !value.includes(picked.id)) {
            onChange([...value, picked.id])
          }
        }}
        search={searchProducts}
        queryKey={["promotions", "product-search"]}
        placeholder={t("promotions.form.addProduct")}
        empty={t("promotions.form.noProducts")}
      />
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => (
            <li
              key={id}
              className="flex items-center gap-1 rounded-md border bg-muted/40 py-1 pr-1 pl-2.5 text-[13px]"
            >
              {nameOf(id)}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t("promotions.form.removeItem", { name: nameOf(id) })}
                onClick={() => {
                  onChange(value.filter((each) => each !== id))
                }}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * Where the promotion applies and when (F4.4, ADR-0024): the whole basket
 * or some categories, collections or products; the least the basket must
 * hold; how often one customer may use it.
 */
export function ConditionsCard({ perCustomerLocked }: { perCustomerLocked: boolean }) {
  const { t } = useTranslation()
  const { control, register, formState } = useFormContext<PromotionValues>()
  const [kind, scope] = useWatch<PromotionValues, ["kind", "scope"]>({ name: ["kind", "scope"] })
  const error = (name: keyof PromotionValues) => {
    const key = formState.errors[name]?.message
    return key ? t(key) : undefined
  }
  return (
    <SectionCard
      title={t("promotions.form.conditions")}
      description={t("promotions.form.conditionsHint")}
    >
      <div className="flex flex-col gap-5">
        {kind === "free_shipping" ? null : (
          <Field label={t("promotions.form.scope")} error={error("scopeIds")}>
            <Controller
              control={control}
              name="scope"
              render={({ field }) => (
                <RadioGroup
                  aria-label={t("promotions.form.scope")}
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid gap-2 sm:grid-cols-4"
                >
                  {SCOPES.map((value) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                    >
                      <RadioGroupItem value={value} />
                      {t(`promotions.form.scopes.${value}`)}
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
            {scope === "all" ? null : (
              <Controller
                control={control}
                name="scopeIds"
                render={({ field }) =>
                  scope === "categories" ? (
                    <CategoryTree value={field.value} onChange={field.onChange} />
                  ) : scope === "collections" ? (
                    <CollectionList value={field.value} onChange={field.onChange} />
                  ) : (
                    <ProductList value={field.value} onChange={field.onChange} />
                  )
                }
              />
            )}
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("promotions.form.minimum")}
            htmlFor="promotion-minimum"
            hint={t("promotions.form.minimumHint")}
            error={error("minimum")}
          >
            <NumberField
              decimals={2}
              min={0}
              className="w-44"
              suffix="₺"
              id="promotion-minimum"
              placeholder={t("promotions.form.none")}
              {...register("minimum")}
            />
          </Field>
          <Field
            label={t("promotions.form.perCustomer")}
            htmlFor="promotion-per-customer"
            hint={t(
              perCustomerLocked
                ? "promotions.form.perCustomerLocked"
                : "promotions.form.perCustomerHint"
            )}
            error={error("perCustomer")}
          >
            <NumberField
              min={1}
              id="promotion-per-customer"
              disabled={perCustomerLocked}
              placeholder={t("promotions.form.unlimited")}
              className="w-44"
              {...register("perCustomer")}
            />
          </Field>
        </div>
      </div>
    </SectionCard>
  )
}
