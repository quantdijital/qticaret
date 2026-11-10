import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { BulkAction } from "@/features/products/api/bulk"
import { categoriesQuery } from "@/features/products/api/lookups"
import { treeOrder } from "@/features/products/category-order"
import { Choices } from "@/features/products/bulk/bulk-choices"
import { BulkCostFields } from "@/features/products/bulk/bulk-cost-fields"
import { bulkChangeOf, examplePrice } from "@/features/products/bulk/bulk-form"
import type { BulkForm } from "@/features/products/bulk/bulk-form"
import { formatMoney } from "@qticaret/admin-ui/lib/format"

export interface FieldsProps {
  form: BulkForm
  onChange: (patch: Partial<BulkForm>) => void
  /** The i18n key of what is wrong, once the person tried to apply. */
  error: string | null
}

// A price change shown on this example, so the direction and size are plain
const EXAMPLE_PRICE = 100

function PriceFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  const result = bulkChangeOf("price", form)
  const example = "change" in result ? examplePrice(result.change, EXAMPLE_PRICE) : null
  return (
    <>
      <Choices
        label={t("products.bulk.price.mode")}
        value={form.priceMode}
        onChange={(priceMode) => {
          onChange({ priceMode })
        }}
        options={(["set", "percent", "amount"] as const).map((value) => ({
          value,
          label: t(`products.bulk.price.modes.${value}`),
        }))}
      />
      {form.priceMode === "set" ? null : (
        <Choices
          label={t("products.bulk.direction")}
          value={form.direction}
          onChange={(direction) => {
            onChange({ direction })
          }}
          options={(["up", "down"] as const).map((value) => ({
            value,
            label: t(`products.bulk.price.directions.${value}`),
          }))}
        />
      )}
      <Field
        label={t(
          form.priceMode === "percent"
            ? "products.bulk.price.percent"
            : "products.bulk.price.amount"
        )}
        htmlFor="bulk-value"
        error={error ? t(error) : undefined}
        hint={
          example !== null && example > 0
            ? t("products.bulk.price.example", {
                from: formatMoney(EXAMPLE_PRICE, "try"),
                to: formatMoney(example, "try"),
              })
            : t("products.bulk.price.hint")
        }
      >
        <NumberField
          decimals={2}
          min={0}
          id="bulk-value"
          autoComplete="off"
          value={form.value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onChange({ value: event.target.value })
          }}
          className="sm:max-w-48"
        />
      </Field>
    </>
  )
}

function StockFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <Choices
        label={t("products.bulk.stock.mode")}
        value={form.stockMode}
        onChange={(stockMode) => {
          onChange({ stockMode })
        }}
        options={(["set", "add", "remove"] as const).map((value) => ({
          value,
          label: t(`products.bulk.stock.modes.${value}`),
        }))}
      />
      <Field
        label={t("products.bulk.stock.quantity")}
        htmlFor="bulk-value"
        hint={t("products.bulk.stock.hint")}
        error={error ? t(error) : undefined}
      >
        <NumberField
          min={0}
          id="bulk-value"
          autoComplete="off"
          value={form.value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onChange({ value: event.target.value })
          }}
          className="sm:max-w-48"
        />
      </Field>
    </>
  )
}

function CategoryFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  const categories = useQuery(categoriesQuery())
  const rows = treeOrder(categories.data ?? [])
  return (
    <>
      <Choices
        label={t("products.bulk.category.mode")}
        value={form.categoryMode}
        onChange={(categoryMode) => {
          onChange({ categoryMode })
        }}
        options={(["add", "remove", "primary"] as const).map((value) => ({
          value,
          label: t(`products.bulk.category.modes.${value}`),
        }))}
      />
      <Field
        label={t("products.bulk.category.label")}
        hint={t(`products.bulk.category.hints.${form.categoryMode}`)}
        error={error ? t(error) : undefined}
      >
        {categories.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("products.wizard.noCategories")}</p>
        ) : (
          <RadioGroup
            aria-label={t("products.bulk.category.label")}
            value={form.categoryId}
            onValueChange={(categoryId) => {
              onChange({ categoryId })
            }}
            className="relative flex max-h-60 flex-col gap-0.5 overflow-y-auto rounded-md border p-1.5"
          >
            {rows.map(({ category, depth }) => (
              <label
                key={category.id}
                className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted"
                style={{ paddingLeft: `${String(8 + depth * 16)}px` }}
              >
                <RadioGroupItem value={category.id} />
                {category.name}
              </label>
            ))}
          </RadioGroup>
        )}
      </Field>
    </>
  )
}

function SeoFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  const box = (key: "seoTitle" | "seoDescription", label: string) => (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <Checkbox
        checked={form[key]}
        onCheckedChange={(checked) => {
          onChange({ [key]: checked === true })
        }}
      />
      {label}
    </label>
  )
  return (
    <Field
      label={t("products.bulk.seo.label")}
      hint={t("products.bulk.seo.hint")}
      error={error ? t(error) : undefined}
    >
      <div className="flex flex-col gap-2">
        {box("seoTitle", t("products.bulk.seo.title"))}
        {box("seoDescription", t("products.bulk.seo.description"))}
      </div>
    </Field>
  )
}

/** The fields of one kind of bulk change. */
export function BulkFields({ action, ...props }: FieldsProps & { action: BulkAction }) {
  const { t } = useTranslation()
  switch (action) {
    case "price":
      return <PriceFields {...props} />
    case "stock":
      return <StockFields {...props} />
    case "status":
      return (
        <>
          <Choices
            label={t("products.bulk.status.label")}
            value={props.form.status}
            onChange={(status) => {
              props.onChange({ status })
            }}
            options={(["published", "draft"] as const).map((value) => ({
              value,
              label: t(`products.bulk.status.options.${value}`),
            }))}
          />
          <p className="text-[13px] text-muted-foreground">
            {t(`products.bulk.status.hints.${props.form.status}`)}
          </p>
        </>
      )
    case "category":
      return <CategoryFields {...props} />
    case "seo_template":
      return <SeoFields {...props} />
    case "alt_text":
      return <p className="text-sm text-muted-foreground">{t("products.bulk.alt.hint")}</p>
    case "cost":
      return <BulkCostFields {...props} />
  }
}
