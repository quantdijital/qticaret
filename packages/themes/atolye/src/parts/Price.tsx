import type { PriceView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A price as the storefront formatted it ("1.299,90 TL"): the shopper's
 * price heavy, the struck price before it small and muted, only when the
 * 30-day rule allows one (F4.3); "…'den başlayan" when variants differ.
 */
export function Price({
  price,
  t,
  size = "card",
  className,
}: {
  price: PriceView
  t: Translate
  size?: "card" | "large"
  className?: string
}) {
  const current = price.from ? t("price.from", { price: price.current }) : price.current
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      {/* Joined by hand: tailwind-merge reads the theme's size names as colours */}
      <span
        className={`tabular font-extrabold tracking-[-0.01em] ${size === "large" ? "text-price" : "text-md lg:text-lg"} ${price.before ? "text-deal" : ""}`}
      >
        {current}
      </span>
      {price.before && (
        <s className="tabular text-sm text-text-3">
          <span className="sr-only">{t("price.before")} </span>
          {price.before}
        </s>
      )}
    </p>
  )
}
