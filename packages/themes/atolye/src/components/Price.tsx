import type { PriceView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A price as the storefront wrote it ("1.299,90 TL"): Hanken 500 with
 * tabular figures. Discounted, the struck-through one first in the quiet
 * ink, then the new one in the discount red (only when the 30-day rule
 * allows a struck price, F4.3).
 */
export function Price({
  price,
  t,
  className,
}: {
  price: PriceView
  t: Translate
  className?: string
}) {
  return (
    <p
      className={cn("tabular flex flex-wrap items-baseline gap-x-2 text-md font-medium", className)}
    >
      {price.before && (
        <s className="text-sm font-normal text-text-3">
          <span className="sr-only">{t("price.before")} </span>
          {price.before}
        </s>
      )}
      <span className={cn(price.before && "text-discount")}>
        {price.from ? t("price.from", { price: price.current }) : price.current}
      </span>
    </p>
  )
}
