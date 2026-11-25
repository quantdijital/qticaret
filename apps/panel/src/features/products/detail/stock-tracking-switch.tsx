import { useState } from "react"
import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { VariantValues } from "./variant-values"

const D = "products.variant"

/**
 * "Stok takibi" (WooCommerce's "Stok yönet"): on, the count is kept and
 * selling stops when it runs out; off, the variant is always sold (the
 * platform's rule for stock not counted). Turning a saved tracking off is
 * asked here, in place: the count is kept for turning it back on. Saved
 * with the rest of the form.
 */
export function StockTrackingSwitch({
  form,
  idPrefix,
  savedTracked,
  locationId,
}: {
  form: UseFormReturn<VariantValues>
  idPrefix: string
  /** Tracked as stored: only turning that off is asked. */
  savedTracked: boolean
  locationId: string | null
}) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const id = `${idPrefix}-tracked`
  return (
    <Controller
      control={form.control}
      name="tracked"
      render={({ field }) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <label htmlFor={id} className="text-sm font-medium">
                {t(`${D}.tracking`)}
              </label>
              <span id={`${id}-hint`} className="text-[13px] text-muted-foreground">
                {field.value
                  ? t(`${D}.trackingOn`)
                  : locationId
                    ? t(`${D}.untracked`)
                    : t("products.detail.variantsNoLocation")}
              </span>
            </div>
            <Switch
              id={id}
              aria-describedby={`${id}-hint`}
              checked={field.value}
              // Without a default location there is nowhere to count; one on can still go off
              disabled={!field.value && !locationId}
              onCheckedChange={(next) => {
                if (!next && savedTracked) {
                  setAsking(true)
                  return
                }
                setAsking(false)
                field.onChange(next)
              }}
            />
          </div>
          {asking && field.value ? (
            <div
              role="group"
              aria-labelledby={`${id}-ask`}
              className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3"
            >
              <p id={`${id}-ask`} className="text-[13px]">
                {t(`${D}.trackingOffAsk`)}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAsking(false)
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAsking(false)
                    field.onChange(false)
                  }}
                >
                  {t(`${D}.trackingOff`)}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    />
  )
}
