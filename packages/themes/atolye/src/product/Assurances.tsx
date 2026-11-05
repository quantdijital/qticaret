import { ArrowUpRight, Truck } from "lucide-react"
import type { ProductPageView, TrustBadgeView, Translate } from "@qticaret/ui"
import { TrustIcon } from "../parts/TrustIcon"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"

/**
 * Asking about this product on WhatsApp (owner 2026-11-06: "WhatsApp
 * butonu daha belirgin ve UX/UI açısından daha verimli kurgulanabilir"):
 * a full-width secondary button under "add to cart", WhatsApp's own mark
 * in its green on a green-tinted fill with a green edge, the chat opening
 * with the product's name and address written in (`whatsappHref`, the
 * shop's number). No promise of how fast the shop answers: the shop sets
 * none.
 */
function AskOnWhatsApp({ href, t }: { href: string; t: Translate }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-pill border border-whatsapp bg-whatsapp/8 px-5 py-2.5 text-md font-semibold text-text no-underline transition-colors duration-(--dur-micro) hover:bg-whatsapp/16 active:translate-y-px"
    >
      <WhatsAppGlyph className="size-6 text-whatsapp" />
      {t("product.whatsapp_button")}
      <ArrowUpRight className="size-4 text-text-2" aria-hidden="true" strokeWidth={2} />
      <span className="sr-only">{t("product.new_tab")}</span>
    </a>
  )
}

/** One promise in a compact row: its icon in a round chip, the title, its line. */
function Fact({ badge }: { badge: TrustBadgeView }) {
  return (
    <li className="flex items-center gap-3 rounded-media bg-paper-2 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-paper">
        <TrustIcon icon={badge.icon} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col text-sm leading-snug">
        <span className="font-semibold">{badge.title}</span>
        {badge.text && <span className="text-xs text-text-2">{badge.text}</span>}
      </span>
    </li>
  )
}

/** The promises of delivery and returns (shipping, clock, returns): the shipping card's to tell. */
const CARD_ICONS: ReadonlySet<TrustBadgeView["icon"]> = new Set(["truck", "clock", "refresh"])

/**
 * The shop's assurances under the buy form. With the "Kargo ve Teslimat"
 * card below (a shipped product, owner 2026-11-05) the delivery and return
 * facts live there only, the shop's own delivery lines too where its
 * settings say them instead (adr/0046 Ek 2026-11-06): here the WhatsApp
 * question first, then the shop's other promises (warranty, safe payment) as compact rows of equal
 * height, two to a row where the column allows; no well around them.
 * Without the card, delivery and returns as plain facts on a filled well
 * (the free shipping line, every promise), the WhatsApp button under it.
 */
export function Assurances({ view, t }: { view: ProductPageView; t: Translate }) {
  const card = view.shipping ?? null
  const whatsapp = view.whatsappHref ? <AskOnWhatsApp href={view.whatsappHref} t={t} /> : null
  if (card) {
    // The card speaks of delivery and returns: its facts, or the shop's settings in their place
    const rest = view.trustBadges.filter((badge) => !CARD_ICONS.has(badge.icon))
    if (rest.length === 0 && !whatsapp) {
      return null
    }
    return (
      <div className="flex flex-col gap-3">
        {whatsapp}
        {rest.length > 0 && (
          <ul
            aria-label={t("product.assurances")}
            className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2"
          >
            {rest.map((badge) => (
              <Fact key={badge.title} badge={badge} />
            ))}
          </ul>
        )}
      </div>
    )
  }
  if (!view.shippingNote && view.trustBadges.length === 0 && !whatsapp) {
    return null
  }
  return (
    <div className="flex flex-col gap-3">
      {whatsapp}
      {(view.shippingNote !== null || view.trustBadges.length > 0) && (
        <section
          aria-labelledby="teslimat"
          className="flex flex-col gap-4 rounded-media bg-paper-2 p-4 lg:p-5"
        >
          <h2 id="teslimat" className="text-md tracking-[-0.01em]">
            {t("product.delivery")}
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
      )}
    </div>
  )
}
