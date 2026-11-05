import { Controller, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { NumberField } from "@/components/patterns/number-field"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogSection } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { ProductDetail } from "@/features/products/api/products"
import { formatCount, formatMoney } from "@/lib/format"
import { MEASURES, measureText } from "./measures"
import { VARIANT_CODES_TARGET } from "./sections"
import { storedGtinNote } from "./variant-codes"
import { levelAt } from "./variant-values"
import type { Variant, VariantField, VariantValues } from "./variant-values"

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

/** The selling price, the unit cost, and (several variants) the price for all of them. */
export function PriceFields({
  form,
  idPrefix,
  sale,
  others,
}: {
  form: Form
  idPrefix: string
  /** The storefront's discounted price today and the one struck through beside it. */
  sale: { price: number; struck: number } | null
  /** How many other variants the price may go to; none for a product of one. */
  others: number
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

/** Stock at the default location, what orders hold, and selling past it (preorder). */
export function StockFields({
  form,
  idPrefix,
  variant,
  locationId,
  preorder,
  preorderOn,
}: {
  form: Form
  idPrefix: string
  variant: Variant
  locationId: string | null
  /** The switch shows; `preorderOn` says whether it may be turned on. */
  preorder: boolean
  preorderOn: boolean
}) {
  const { t } = useTranslation()
  const error = useError(form)
  const level = levelAt(variant, locationId)
  if (!variant.manage_inventory) {
    return (
      <DialogSection title={t(`${D}.stock`)}>
        <p className="text-[13px] text-muted-foreground">{t(`${D}.untracked`)}</p>
      </DialogSection>
    )
  }
  return (
    <DialogSection
      title={t(`${D}.stock`)}
      description={t(locationId ? `${D}.stockHint` : "products.detail.variantsNoLocation")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(`${D}.onHand`)} htmlFor={`${idPrefix}-stock`} error={error("stock")}>
          <NumberField
            id={`${idPrefix}-stock`}
            min={0}
            aria-invalid={Boolean(error("stock"))}
            disabled={!locationId}
            {...form.register("stock")}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("products.detail.reserved")}</span>
          <span className="flex h-9 items-center text-sm tabular-nums">
            {formatCount(level.reserved)}
          </span>
        </div>
      </div>
      {preorder ? (
        <div className="flex items-start justify-between gap-4 border-t pt-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor={`${idPrefix}-backorder`} className="text-sm font-medium">
              {t("products.detail.backorder")}
            </label>
            <span id={`${idPrefix}-backorder-hint`} className="text-[13px] text-muted-foreground">
              {t(`${D}.backorderHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="backorder"
            render={({ field }) => (
              <Switch
                id={`${idPrefix}-backorder`}
                aria-describedby={`${idPrefix}-backorder-hint`}
                checked={field.value}
                onCheckedChange={field.onChange}
                // Without the flag, one already on can only be turned off
                disabled={!preorderOn && !variant.allow_backorder}
              />
            )}
          />
        </div>
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
  product,
  units,
}: {
  form: Form
  idPrefix: string
  product: ProductDetail
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
              placeholder={measureText(product[name]) || "—"}
              aria-invalid={Boolean(error(name))}
              {...form.register(name)}
            />
          </Field>
        ))}
      </div>
    </DialogSection>
  )
}
