import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import { Input } from "@qticaret/admin-ui/ui/input"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { brandOptions } from "@/features/brands/api/brands"
import { Choices } from "@/features/products/bulk/bulk-choices"
import type { FieldsProps } from "@/features/products/bulk/bulk-fields"
import { bulkChangeOf, examplePrice } from "@/features/products/bulk/bulk-form"

/**
 * WooCommerce's bulk edit fields we add (P7 + the sale of adr/0086): the
 * sale price, the brand, a tag and selling past stock.
 */

const S = "products.bulk.sale"
// The sale shown on this example regular price, so the size is plain
const EXAMPLE_PRICE = 100

export function BulkSaleFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  const result = bulkChangeOf("sale", form)
  const example = "change" in result ? examplePrice(result.change, EXAMPLE_PRICE) : null
  return (
    <>
      <Choices
        label={t(`${S}.mode`)}
        value={form.saleMode}
        onChange={(saleMode) => {
          onChange({ saleMode })
        }}
        options={(["percent", "amount", "clear"] as const).map((value) => ({
          value,
          label: t(`${S}.modes.${value}`),
        }))}
      />
      {form.saleMode === "clear" ? (
        <p className="text-[13px] text-muted-foreground">{t(`${S}.clearHint`)}</p>
      ) : (
        <>
          <Field
            label={t(form.saleMode === "percent" ? `${S}.percent` : `${S}.amount`)}
            htmlFor="bulk-value"
            error={error ? t(error) : undefined}
            hint={
              example !== null && example > 0
                ? t("products.bulk.price.example", {
                    from: formatMoney(EXAMPLE_PRICE, "try"),
                    to: formatMoney(example, "try"),
                  })
                : t(`${S}.hint`)
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t(`${S}.starts`)} htmlFor="bulk-sale-starts" hint={t(`${S}.daysHint`)}>
              <Input
                id="bulk-sale-starts"
                type="date"
                value={form.saleStarts}
                onChange={(event) => {
                  onChange({ saleStarts: event.target.value })
                }}
              />
            </Field>
            <Field label={t(`${S}.ends`)} htmlFor="bulk-sale-ends">
              <Input
                id="bulk-sale-ends"
                type="date"
                value={form.saleEnds}
                onChange={(event) => {
                  onChange({ saleEnds: event.target.value })
                }}
              />
            </Field>
          </div>
        </>
      )}
    </>
  )
}

export function BulkBrandFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <Choices
        label={t("products.bulk.brand.mode")}
        value={form.brandMode}
        onChange={(brandMode) => {
          onChange({ brandMode })
        }}
        className="sm:grid-cols-2"
        options={(["set", "clear"] as const).map((value) => ({
          value,
          label: t(`products.bulk.brand.modes.${value}`),
        }))}
      />
      {form.brandMode === "clear" ? (
        <p className="text-[13px] text-muted-foreground">{t("products.bulk.brand.clearHint")}</p>
      ) : (
        <Field
          label={t("brands.field")}
          htmlFor="bulk-brand"
          hint={t("products.bulk.brand.hint")}
          error={error ? t(error) : undefined}
        >
          <SearchPicker
            id="bulk-brand"
            value={form.brand}
            onChange={(brand) => {
              onChange({ brand })
            }}
            search={brandOptions}
            queryKey={["brands", "options"]}
            placeholder={t("brands.pick")}
            empty={t("brands.noneFound")}
            inactiveNote={t("brands.inactive")}
          />
        </Field>
      )}
    </>
  )
}

export function BulkTagFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <Choices
        label={t("products.bulk.tag.mode")}
        value={form.tagMode}
        onChange={(tagMode) => {
          onChange({ tagMode })
        }}
        className="sm:grid-cols-2"
        options={(["add", "remove"] as const).map((value) => ({
          value,
          label: t(`products.bulk.tag.modes.${value}`),
        }))}
      />
      <Field
        label={t("products.tags.field")}
        htmlFor="bulk-tag"
        hint={t(`products.bulk.tag.hints.${form.tagMode}`)}
        error={error ? t(error) : undefined}
      >
        <Input
          placeholder={t("products.placeholders.tag")}
          id="bulk-tag"
          autoComplete="off"
          maxLength={100}
          value={form.tag}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onChange({ tag: event.target.value })
          }}
          className="sm:max-w-80"
        />
      </Field>
    </>
  )
}

export function BulkBackorderFields({ form, onChange }: FieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <Choices
        label={t("products.bulk.backorder.label")}
        value={form.backorder}
        onChange={(backorder) => {
          onChange({ backorder })
        }}
        className="sm:grid-cols-2"
        options={(["allow", "deny"] as const).map((value) => ({
          value,
          label: t(`products.bulk.backorder.options.${value}`),
        }))}
      />
      <p className="text-[13px] text-muted-foreground">{t("products.bulk.backorder.hint")}</p>
    </>
  )
}
