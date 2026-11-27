import { Truck } from "lucide-react"
import type { ProductPageView, TrustBadgeView, Translate } from "@qticaret/ui"
import { TrustIcon } from "../parts/TrustIcon"

/**
 * One promise in a compact row: its icon in a round chip, the title, its
 * line. On a phone one low row each, title and line one line apiece (an
 * ellipsis); from `sm` two to a row, the title and the line two lines at
 * most, so no tile stretches its row (owner 2026-11-27). Clamped text
 * stays whole in the markup for a screen reader.
 */
function Fact({ badge, wide }: { badge: TrustBadgeView; wide: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-media gf-box px-3 py-2 sm:py-3${wide ? " sm:col-span-2" : ""}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-paper sm:size-9">
        <TrustIcon icon={badge.icon} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col text-sm leading-snug">
        <span className="truncate font-semibold sm:line-clamp-2 sm:whitespace-normal">
          {badge.title}
        </span>
        {badge.text && (
          <span className="truncate text-xs text-text-2 sm:line-clamp-2 sm:whitespace-normal">
            {badge.text}
          </span>
        )}
      </span>
    </li>
  )
}

/** The promises of delivery and returns (shipping, clock, returns): the shipping card's to tell. */
const CARD_ICONS: ReadonlySet<TrustBadgeView["icon"]> = new Set(["truck", "clock", "refresh"])

/**
 * The shop's assurances under the buy form (the WhatsApp question sits in
 * the purchase group above, `AskOnWhatsApp`). With the "Kargo ve Teslimat"
 * card below (a shipped product, owner 2026-11-05) the delivery and return
 * facts live there only, the shop's own delivery lines too where its
 * settings say them instead (adr/0046 Ek 2026-11-06): here the shop's other
 * promises (warranty, safe payment) as compact tiles of equal height, two to
 * a row; no well around them. Owner decision 2026-11-27 (adr/0066 owner
 * change, docs/tema/bilesen-standardi.md §7): the tiles show only as a group
 * of two or more (a lone tile looked stranded; the badge still shows on the
 * home strip, footer and cart); one low row each on a phone, from `sm` two
 * to a row with an odd last tile spanning it so no cell stands empty. Without the card,
 * delivery and returns as plain facts on a filled well (the free shipping
 * line, every promise).
 */
export function Assurances({ view, t }: { view: ProductPageView; t: Translate }) {
  const card = view.shipping ?? null
  if (card) {
    // The card speaks of delivery and returns: its facts, or the shop's settings in their place
    const rest = view.trustBadges.filter((badge) => !CARD_ICONS.has(badge.icon))
    if (rest.length < 2) {
      return null
    }
    const odd = rest.length % 2 === 1
    return (
      <ul
        aria-label={t("product.assurances")}
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2"
      >
        {rest.map((badge, index) => (
          <Fact key={badge.title} badge={badge} wide={odd && index === rest.length - 1} />
        ))}
      </ul>
    )
  }
  if (!view.shippingNote && view.trustBadges.length === 0) {
    return null
  }
  return (
    <section
      aria-labelledby="teslimat"
      className="flex flex-col gap-4 rounded-media gf-box p-4 lg:p-5"
    >
      <h2 id="teslimat" className="text-md tracking-[-0.01em]">
        {t(view.unshipped ? "product.promises" : "product.delivery")}
      </h2>
      <ul className="flex flex-col gap-3 text-sm">
        {view.shippingNote && (
          <li className="flex items-start gap-3">
            <Truck className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            <span className="font-semibold">{view.shippingNote}</span>
          </li>
        )}
        {view.trustBadges.map((badge) => (
          <li key={badge.title} className="flex items-start gap-3">
            <TrustIcon icon={badge.icon} className="size-5 shrink-0" />
            <span>
              <span className="font-semibold">{badge.title}</span>
              {badge.text && <span className="block text-text-2">{badge.text}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
