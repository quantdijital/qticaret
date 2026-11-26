import { Controller, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { MEASURES, measureText } from "./measures"
import { SalePriceField, SalePriceView } from "./sale-price-field"
import type { MeasureName } from "./measures"
import { VARIANT_CODES_TARGET } from "./sections"
import type { SaleTarget, VariantSale } from "./use-variant-sale"
import { storedGtinNote } from "./variant-codes"
import type { VariantField, VariantValues } from "./variant-values"

// Stock has its own file; the dialog, the rows and the cards import it from here
export { StockFields } from "./stock-fields"

type Form = UseFormReturn<VariantValues>

const D = "products.variant"

/** A refused value as its sentence, under its field. */
function useError(form: Form) {
  const { t } = useTranslation()
  return (name: VariantField) => {
    const message = form.formState.errors[name]?.message
    return message ? t(message) : undefined
  }
}

export type { SaleTarget } from "./use-variant-sale"

/**
 * The regular price, the unit cost, the sale price of a saved variant
 * (adr/0086) and (several variants) the price for all of them. The sale
 * price is the host's (`saleOf`, saved with its form) or its own
 * (`saleTarget`, saved by its own button and the page's header save).
 */
export function PriceFields({
  form,
  idPrefix,
  sale,
  others,
  saleTarget = null,
  saleOf = null,
}: {
  form: Form
  idPrefix: string
  /** The storefront's discounted price today and the one struck through beside it. */
  sale: { price: number; struck: number } | null
  /** How many other variants the price may go to; none for a product of one. */
  others: number
  /** A saved variant: its "İndirimli fiyat" under the price; none on a new product. */
  saleTarget?: SaleTarget | null
  /** A saved variant's sale price that the host saves with its own form. */
  saleOf?: VariantSale | null
}) {
  const { t } = useTranslation()
  const error = useError(form)
  return (
    <DialogSection title={t(`${D}.price`)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t(`${D}.sellingPrice`)}
          htmlFor={`${idPrefix}-price`}
          error={error("price")}
          hint={t(`${D}.priceHint`)}
        >
          <NumberField
            id={`${idPrefix}-price`}
            decimals={2}
            min={0}
            suffix="₺"
            aria-invalid={Boolean(error("price"))}
            {...form.register("price")}
          />
        </Field>
        <Field
          label={t("products.detail.cost")}
          htmlFor={`${idPrefix}-cost`}
          error={error("cost")}
          hint={t("products.detail.costHint")}
        >
          <NumberField
            id={`${idPrefix}-cost`}
            decimals={2}
            min={0}
            suffix="₺"
            placeholder="—"
            aria-invalid={Boolean(error("cost"))}
            {...form.register("cost")}
          />
        </Field>
      </div>
      {saleOf ? <SalePriceView sale={saleOf} idPrefix={idPrefix} own={false} /> : null}
      {saleTarget && !saleOf ? (
        <SalePriceField
          key={saleTarget.variantId}
          productId={saleTarget.productId}
          variantId={saleTarget.variantId}
          idPrefix={idPrefix}
        />
      ) : null}
      {sale ? (
        <p className="text-xs text-muted-foreground">
          {t("products.priceHistory.struckDetail", {
            before: formatMoney(sale.struck, "try"),
            price: formatMoney(sale.price, "try"),
          })}
        </p>
      ) : null}
      {others > 0 ? (
        <Controller
          control={form.control}
          name="applyAll"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked === true)
                }}
              />
              {t(`${D}.applyAll`, { count: others })}
            </label>
          )}
        />
      ) : null}
    </DialogSection>
  )
}

const CODE = "font-mono md:text-[13px]"

/** The stock code (SKU), the barcode (GTIN) and the manufacturer part number (MPN). */
export function CodeFields({
  form,
  idPrefix,
  saved,
}: {
  form: Form
  idPrefix: string
  /** As stored: a stored barcode that is not a GTIN is pointed out, not refused. */
  saved: VariantValues
}) {
  const { t } = useTranslation()
  const error = useError(form)
  const codes = useWatch({ control: form.control, name: ["sku", "gtin", "mpn"] })
  const note = storedGtinNote({ sku: codes[0], gtin: codes[1], mpn: codes[2] }, saved)
  return (
    <DialogSection title={t(`${D}.codes`)} description={t("products.detail.codes.hint")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t("products.detail.codes.sku")}
          htmlFor={`${idPrefix}-sku`}
          error={error("sku")}
        >
          <Input
            id={`${idPrefix}-sku`}
            autoComplete="off"
            spellCheck={false}
            placeholder="—"
            className={CODE}
            aria-invalid={Boolean(error("sku"))}
            {...form.register("sku")}
          />
        </Field>
        <Field
          label={t("products.detail.codes.gtin")}
          // The advisor's "barcode missing" lands here
          htmlFor={VARIANT_CODES_TARGET}
          error={error("gtin")}
          hint={note ? t(note) : undefined}
        >
          <Input
            id={VARIANT_CODES_TARGET}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="—"
            className={`${CODE} scroll-mt-32 tabular-nums`}
            aria-invalid={Boolean(error("gtin"))}
            {...form.register("gtin")}
          />
        </Field>
        <Field
          label={t("products.detail.codes.mpn")}
          htmlFor={`${idPrefix}-mpn`}
          error={error("mpn")}
        >
          <Input
            id={`${idPrefix}-mpn`}
            autoComplete="off"
            spellCheck={false}
            placeholder="—"
            className={CODE}
            aria-invalid={Boolean(error("mpn"))}
            {...form.register("mpn")}
          />
        </Field>
      </div>
    </DialogSection>
  )
}

/** The variant's own parcel; an empty measure takes the product's (shown in its place). */
export function MeasureFields({
  form,
  idPrefix,
  fallback,
  units,
}: {
  form: Form
  idPrefix: string
  /** The product's measures, shown where the variant has none of its own. */
  fallback: Partial<Record<MeasureName, number | null | undefined>>
  units: { weight: string; dimension: string }
}) {
  const { t } = useTranslation()
  const error = useError(form)
  return (
    <DialogSection title={t(`${D}.measures`)} description={t(`${D}.measuresHint`)}>
      <div className="grid grid-cols-2 gap-4">
        {MEASURES.map(({ name, unit }) => (
          <Field
            key={name}
            label={t(`products.wizard.measures.${name}`)}
            htmlFor={`${idPrefix}-${name}`}
            error={error(name)}
          >
            <NumberField
              id={`${idPrefix}-${name}`}
              decimals={3}
              min={0}
              suffix={units[unit]}
              // The product's measure, used while this one is empty
              placeholder={measureText(fallback[name]) || "—"}
              aria-invalid={Boolean(error(name))}
              {...form.register(name)}
            />
          </Field>
        ))}
      </div>
    </DialogSection>
  )
}
