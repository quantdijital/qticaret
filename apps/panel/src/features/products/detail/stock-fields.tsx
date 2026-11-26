import { Controller, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { StockTrackingSwitch } from "./stock-tracking-switch"
import type { StockFacts, VariantValues } from "./variant-values"

type Form = UseFormReturn<VariantValues>

const D = "products.variant"

/** The stock count's refused value as its sentence, under it. */
function useStockError(form: Form) {
  const { t } = useTranslation()
  const message = form.formState.errors.stock?.message
  return message ? t(message) : undefined
}

/** Stock at the default location, what orders hold, and selling past it (preorder). */
export function StockFields({
  form,
  idPrefix,
  stock,
  locationId,
  preorder,
  preorderOn,
}: {
  form: Form
  idPrefix: string
  /** Tracked or not, what orders hold, preorder as stored (`stockFacts`). */
  stock: StockFacts
  locationId: string | null
  /** The switch shows; `preorderOn` says whether it may be turned on. */
  preorder: boolean
  preorderOn: boolean
}) {
  const { t } = useTranslation()
  const typed = useWatch({ control: form.control, name: "tracked" })
  const tracked = stock.fixed ? stock.tracked : typed
  return (
    // The location's note sits under the count, as the price's does under the price: a
    // section description would push the stock fields below the price fields beside them
    <DialogSection title={t(`${D}.stock`)}>
      {stock.fixed ? (
        tracked ? null : (
          <p className="text-[13px] text-muted-foreground">{t(`${D}.untracked`)}</p>
        )
      ) : (
        <StockTrackingSwitch
          form={form}
          idPrefix={idPrefix}
          savedTracked={stock.tracked}
          locationId={locationId}
        />
      )}
      {tracked ? (
        <TrackedFields
          form={form}
          idPrefix={idPrefix}
          stock={stock}
          locationId={locationId}
          preorder={preorder}
          preorderOn={preorderOn}
        />
      ) : null}
    </DialogSection>
  )
}

/** The count, what orders hold and preorder: shown while the stock is tracked. */
function TrackedFields({
  form,
  idPrefix,
  stock,
  locationId,
  preorder,
  preorderOn,
}: {
  form: Form
  idPrefix: string
  stock: StockFacts
  locationId: string | null
  preorder: boolean
  preorderOn: boolean
}) {
  const { t } = useTranslation()
  const error = useStockError(form)
  return (
    <>
      <div className={`grid gap-4 sm:grid-cols-2 ${stock.fixed ? "" : "border-t pt-4"}`}>
        <Field
          label={t(`${D}.onHand`)}
          htmlFor={`${idPrefix}-stock`}
          error={error}
          hint={t(locationId ? `${D}.stockHint` : "products.detail.variantsNoLocation")}
        >
          <NumberField
            id={`${idPrefix}-stock`}
            min={0}
            aria-invalid={Boolean(error)}
            disabled={!locationId}
            {...form.register("stock")}
          />
        </Field>
        {stock.reserved === null ? null : (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("products.detail.reserved")}</span>
            <span className="flex h-9 items-center text-sm tabular-nums">
              {formatCount(stock.reserved)}
            </span>
          </div>
        )}
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
                disabled={!preorderOn && !stock.backorder}
              />
            )}
          />
        </div>
      ) : null}
    </>
  )
}
