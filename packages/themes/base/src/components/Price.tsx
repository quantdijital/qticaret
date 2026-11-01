import type { PriceView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** The price, the struck-through one beside it only when the 30-day rule allows (F4.3). */
export function Price({
  price,
  t,
  size = "md",
  className,
}: {
  price: PriceView
  t: Translate
  size?: "md" | "lg"
  className?: string
}) {
  return (
    <p className={cn("tabular flex flex-wrap items-baseline gap-x-2", className)}>
      <span
        className={cn(
          "font-semibold",
          size === "lg" ? "text-2xl lg:text-3xl" : "text-base",
          price.before && "text-sale"
        )}
      >
        {price.from ? t("price.from", { price: price.current }) : price.current}
      </span>
      {price.before && (
        <s className={cn("text-muted-foreground", size === "lg" ? "text-base" : "text-sm")}>
          <span className="sr-only">{t("price.before")} </span>
          {price.before}
        </s>
      )}
    </p>
  )
}
