import { BellRing, PenLine } from "lucide-react"
import type { CardShownView, ProductCardView, Translate } from "@qticaret/ui"
import { REVIEWS_ID, STOCK_ALERT_ID } from "../product/anchors"
import { CardRating, isOut } from "./card-parts"
import { Price } from "./Price"
import { Stars } from "./Stars"

/**
 * Today's card (adr/0049 Ek 2026-11-15): what a card without `shown`
 * draws, every pill, the price on a sold-out card, no stars without reviews.
 */
const TODAY: CardShownView = {
  saleBadge: true,
  lowStockBadge: true,
  soldOutBadge: true,
  soldOutRow: "price",
  noReviews: "hide",
}

/** What the shop set the card to show; today's card when the storefront says nothing. */
export const shownOf = (product: ProductCardView): CardShownView => product.shown ?? TODAY

// A link inside a card sits over the card's own link (`after:inset-0` on the title)
const OVER = "relative z-(--z-raised) font-semibold text-text underline underline-offset-4"

/**
 * Where the stars stand: the product's own, or without reviews what the
 * shop chose (the storefront says `hide` when the stars are off or its
 * reviews unknown): empty stars and "Henüz yorum yok", the words on one
 * line under the stars on a narrow card; or "İlk yorumu sen yaz" to its
 * page's reviews.
 */
export function CardStars({ product, t }: { product: ProductCardView; t: Translate }) {
  if (product.rating) {
    return <CardRating rating={product.rating} />
  }
  const { noReviews } = shownOf(product)
  if (noReviews === "empty_stars") {
    return (
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-3">
        <Stars rating={0} />
        <span className="whitespace-nowrap">{t("product.card_no_reviews")}</span>
      </p>
    )
  }
  if (noReviews === "write_first") {
    return (
      <p className="flex items-center gap-1.5 text-xs">
        <PenLine className="size-4 shrink-0 text-text-3" aria-hidden="true" strokeWidth={1.75} />
        <a
          href={`${product.path}#${REVIEWS_ID}`}
          className={OVER}
          aria-label={t("product.card_write_first_label", { title: product.title })}
        >
          {t("product.card_write_first")}
        </a>
      </p>
    )
  }
  return null
}

/**
 * The price row: the price, or on a sold-out card what the shop chose:
 * "Tükendi" in its place, or "Gelince haber ver" to its page's stock alert
 * form. Nothing adds a sold-out card to the cart in any of them.
 */
export function CardPriceRow({
  product,
  t,
  className = "",
}: {
  product: ProductCardView
  t: Translate
  className?: string
}) {
  const row = isOut(product) ? shownOf(product).soldOutRow : "price"
  if (row === "text") {
    return (
      <p className={`text-sm font-semibold text-text-2 ${className}`}>
        {t("product.out_of_stock")}
      </p>
    )
  }
  if (row === "notify") {
    return (
      <p className={`flex items-center gap-1.5 text-sm ${className}`}>
        <BellRing className="size-4 shrink-0 text-text-3" aria-hidden="true" strokeWidth={1.75} />
        <a
          href={`${product.path}#${STOCK_ALERT_ID}`}
          className={OVER}
          aria-label={t("product.card_notify_label", { title: product.title })}
        >
          {t("product.card_notify")}
        </a>
      </p>
    )
  }
  return product.price ? <Price price={product.price} t={t} className={className} /> : null
}
