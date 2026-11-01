import type { PriceView, Translate } from "@qticaret/ui"

/** The price, the struck-through one beside it only when the 30-day rule allows (F4.3). */
export function Price({
  price,
  t,
  size = "md",
}: {
  price: PriceView
  t: Translate
  size?: "md" | "lg"
}) {
  const current = size === "lg" ? "text-2xl font-semibold" : "font-semibold"
  return (
    <p className="flex flex-wrap items-baseline gap-2">
      {price.before && (
        <s className="text-sm text-muted">
          <span className="sr-only">{t("price.before")} </span>
          {price.before}
        </s>
      )}
      <span className={price.before ? `${current} text-sale` : current}>
        {price.from ? t("price.from", { price: price.current }) : price.current}
      </span>
    </p>
  )
}
