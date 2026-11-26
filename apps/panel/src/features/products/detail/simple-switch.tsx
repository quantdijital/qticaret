import { Loader2, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { useMakeSimple } from "@/features/products/api/product-simple"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { usePlaceholderOption } from "./placeholder-option"
import { realOptions, simplePlan } from "./simple-plan"
import type { DataCardState } from "./use-data-card"
import { variantName } from "./variant-facts"
import { priceOf } from "./variant-values"
import type { Variant } from "./variant-values"

const D = "products.data.toSimple"

/** Its count over every stock location; null when its stock is not counted. */
function stockOf(variant: Variant): number | null {
  if (!variant.manage_inventory) {
    return null
  }
  return (variant.inventory_items ?? []).reduce(
    (sum, item) =>
      sum +
      (item.inventory?.location_levels ?? []).reduce(
        (each, level) => each + level.stocked_quantity,
        0
      ),
    0
  )
}

/**
 * "Basit ürün" picked on a product that is not simple (docs/06 "Ürün
 * sayfası", "Ürün verileri"): the card asks in place, no dialog. One
 * variant: its options go, its price, stock and codes stay. Several: the
 * person picks the one that stays (the first by default, with its price
 * and stock), the others are deleted (a warning, not a refusal, when they
 * hold stock), then the options go. "Vazgeç" leaves everything as it was;
 * a refusal is said here and the product is read again.
 */
export function SimpleSwitch({ product, state }: { product: ProductDetail; state: DataCardState }) {
  const { t } = useTranslation()
  const variants = product.variants ?? []
  const [keep, setKeep] = useState(variants[0]?.id ?? "")
  const make = useMakeSimple(product.id)
  const placeholder = usePlaceholderOption()
  const options = realOptions(product, placeholder).map((option) => option.title)
  const others = variants.filter((variant) => variant.id !== keep)
  const stocked = others.filter((variant) => (stockOf(variant) ?? 0) > 0)
  const units = stocked.reduce((sum, variant) => sum + (stockOf(variant) ?? 0), 0)
  const confirm = () => {
    // Not `mutate`'s own onSuccess: the product read again is simple, so this
    // question is gone before it would run (an unmounted caller's callbacks never do)
    make.mutateAsync(simplePlan(product, keep, placeholder)).then(state.madeSimple, () => {
      // Said in the card while it is still asked (`make.isError`)
    })
  }
  return (
    <div
      role="group"
      aria-labelledby="product-to-simple-title"
      data-to-simple=""
      className="flex flex-col gap-3 border-b bg-muted/40 px-5 py-4 text-sm"
    >
      <p id="product-to-simple-title" className="font-medium">
        {t(`${D}.title`)}
      </p>
      {others.length > 0 ? (
        <>
          <p>{t(`${D}.several`, { count: others.length })}</p>
          <RadioGroup
            value={keep}
            onValueChange={setKeep}
            aria-label={t(`${D}.keep`)}
            className="gap-1.5"
            disabled={make.isPending}
          >
            {variants.map((variant) => {
              const price = priceOf(variant)
              const stock = stockOf(variant)
              const id = `to-simple-${variant.id}`
              return (
                <label
                  key={variant.id}
                  htmlFor={id}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border bg-card px-3 py-2 has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem id={id} value={variant.id} />
                  <span className="min-w-0 flex-1 truncate">{variantName(product, variant)}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {price === null ? t(`${D}.noPrice`) : formatMoney(price, "try")}
                  </span>
                  <span className="w-28 shrink-0 text-right text-muted-foreground tabular-nums">
                    {stock === null
                      ? t(`${D}.untracked`)
                      : t(`${D}.stock`, { count: stock, formatted: formatCount(stock) })}
                  </span>
                </label>
              )
            })}
          </RadioGroup>
          {stocked.length > 0 ? (
            <p className="flex items-start gap-2 text-warning-text">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t(`${D}.stockWarning`, { count: stocked.length, units: formatCount(units) })}
            </p>
          ) : null}
        </>
      ) : null}
      {options.length > 0 ? <p>{t(`${D}.options`, { options: options.join(", ") })}</p> : null}
      {make.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorText(t, make.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="cancel"
          size="sm"
          disabled={make.isPending}
          onClick={state.cancel}
        >
          {t(`${D}.cancel`)}
        </Button>
        <Button
          type="button"
          variant={others.length > 0 ? "destructive" : "default"}
          size="sm"
          disabled={make.isPending || keep === ""}
          onClick={confirm}
        >
          {make.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {others.length > 0
            ? t(`${D}.deleteAndSwitch`, { count: others.length })
            : t(`${D}.switch`)}
        </Button>
      </div>
    </div>
  )
}
