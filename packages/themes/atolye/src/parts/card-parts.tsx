import { Star } from "lucide-react"
import type { CardRatingView, CardVariant, ProductCardView, Translate } from "@qticaret/ui"
import type { QuickAddWords } from "./QuickAdd"
import { Stars } from "./Stars"

/** The add-to-cart action's message keys a quick add can come back with. */
const QUICK_ADD_ERRORS = [
  "cart.add_failed",
  "cart.quantity_invalid",
  "cart.insufficient_stock",
  "cart.payment_link_locked",
  "errors.too_many_requests",
] as const

/** A quick add's words for a product. */
export const quickAddWords = (t: Translate, title: string): QuickAddWords => ({
  add: t("product.quick_add"),
  label: t("product.quick_add_label", { title }),
  added: t("product.quick_added"),
  errors: {
    ...Object.fromEntries(QUICK_ADD_ERRORS.map((key) => [key, t(key)])),
    "cart.variant_unavailable": t("product.quick_add_unavailable"),
  },
  openPage: t("product.quick_add_open"),
})

export const isOut = (product: ProductCardView) => !product.available || product.stock === "out"

/**
 * The card variant Atölye draws (adr/0049 Ek 2026-11-14 §2.3): `framed`
 * when the card carries its own, `compact` as it is (Ek 2026-11-15);
 * anything else, a variant this build does not know included, today's card.
 */
export const drawnCardVariant = (product: ProductCardView): CardVariant =>
  product.variant === "framed" && product.framed
    ? "framed"
    : product.variant === "compact"
      ? "compact"
      : "standard"

/**
 * Which pills the shop shows (adr/0049 Ek 2026-11-15): each on unless the
 * card's `shown` turns it off, so a card without it draws today's.
 */
export const badgesOf = (product: ProductCardView) => ({
  sale: product.shown?.saleBadge ?? true,
  lowStock: product.shown?.lowStockBadge ?? true,
  soldOut: product.shown?.soldOutBadge ?? true,
})

/** Whether a standard card's words stand over its photo (adr/0077 Ek "tur kartı"). */
export const textOver = (product: ProductCardView): boolean =>
  !!product.look?.over && drawnCardVariant(product) === "standard"

/**
 * Whether the card's stars stand as a pill on its photo (adr/0077 Ek "tur
 * kartı"): the card has them, it has the pills on its photo (the compact
 * card keeps its row), and the shop asked for the pill or put the words
 * over the photo (no stars' row there).
 */
export const ratingBadged = (product: ProductCardView): boolean =>
  !!product.rating &&
  drawnCardVariant(product) !== "compact" &&
  (!!product.look?.ratingBadge || textOver(product))

/**
 * The pills on a card's photo: the shop's badge ("Sınırlı", "Çok satan",
 * "Yeni") when it has one on, the stars' average when the shop puts them
 * there ("★ 4,8", the reader hears the rating's whole sentence), a
 * discount ("%30", the reader hears "%30 indirim"), then "Tükendi" or "Az
 * kaldı" (a stock bucket, never a number); each as the shop shows it.
 */
export function CardBadges({ product, t }: { product: ProductCardView; t: Translate }) {
  const badges = badgesOf(product)
  const discount = badges.sale ? (product.price?.discount ?? null) : null
  const out = isOut(product)
  const rating = ratingBadged(product) ? product.rating : null
  const badge = product.badge ?? null
  return (
    <ul className="absolute top-2 left-2 flex flex-wrap gap-1 text-xs font-extrabold">
      {/* The shop's badge first, the stars' pill beside it: the row wraps, they never overlap */}
      {badge && (
        <li
          data-badge={badge.kind}
          className="max-w-full truncate rounded-pill bg-signal px-2 py-1 text-signal-ink"
        >
          {badge.text}
        </li>
      )}
      {rating && (
        <li className="flex items-center gap-1 rounded-pill bg-field px-2 py-1 text-text">
          <Star className="size-3.5 fill-star text-star" aria-hidden="true" strokeWidth={1.5} />
          <span aria-hidden="true" className="tabular">
            {rating.average}
          </span>
          <span className="sr-only">{rating.label}</span>
        </li>
      )}
      {discount !== null && (
        <li className="rounded-pill bg-deal px-2 py-1 text-deal-ink">
          <span aria-hidden="true">{t("product.discount_short", { percent: discount })}</span>
          <span className="sr-only">{t("product.discount", { percent: discount })}</span>
        </li>
      )}
      {out
        ? badges.soldOut && (
            <li className="rounded-pill bg-text px-2 py-1 text-paper">
              {t("product.out_of_stock")}
            </li>
          )
        : badges.lowStock &&
          product.stock === "low" && (
            <li className="rounded-pill bg-field px-2 py-1 text-text">{t("product.few_left")}</li>
          )}
    </ul>
  )
}

/** A card's stars: "4,3 (12)" for the eye, the label's whole sentence for a screen reader. */
export function CardRating({ rating }: { rating: CardRatingView }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-text-2">
      <Stars rating={Number(rating.average.replace(",", "."))} />
      <span aria-hidden="true" className="tabular">
        <span className="font-semibold text-text">{rating.average}</span> ({rating.count})
      </span>
      <span className="sr-only">{rating.label}</span>
    </p>
  )
}
