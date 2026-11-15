import type { ProductShippingView, Translate } from "@qticaret/ui"
import { Marks } from "../content/Facts"
import { TrustIcon } from "../parts/TrustIcon"

/**
 * "Kargo ve Teslimat" beside the description and the specs (owner
 * 2026-11-05: "bu ürün özelliklerinin yanında genel bir kargo
 * bilgilendirmesi alanı ekleyelim"): one soft card, the shop's facts each
 * with its icon in a round chip (free shipping, its own delivery
 * promises, the return window), the carriers' own marks, then the shop's
 * shipping page and its return policy. Every word is the storefront's,
 * from the shop's settings and lines.
 */
export function ShippingCard({ shipping, t }: { shipping: ProductShippingView; t: Translate }) {
  return (
    <section
      id="kargo-ve-teslimat"
      aria-labelledby="kargo-ve-teslimat-baslik"
      className="flex scroll-mt-40 flex-col gap-5 rounded-tile bg-paper-2 p-5 sm:p-6"
    >
      {/* The page's one heading size and no arrow on a link (Tezgâh audits K-13, Y-09) */}
      <h2 id="kargo-ve-teslimat-baslik" className="text-section">
        {t("product.shipping_title")}
      </h2>
      {shipping.facts.length > 0 && (
        <ul className="flex flex-col gap-4">
          {shipping.facts.map((fact) => (
            <li key={`${fact.icon}-${fact.title}`} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-paper">
                <TrustIcon icon={fact.icon} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col pt-0.5 text-sm">
                <span className="font-semibold">{fact.title}</span>
                {fact.text && <span className="text-text-2">{fact.text}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {shipping.carriers.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-rule pt-5">
          <h3 className="text-sm font-semibold tracking-normal">
            {t("product.shipping_carriers")}
          </h3>
          <Marks marks={shipping.carriers} />
        </div>
      )}
      {shipping.links.length > 0 && (
        <ul className="flex flex-col border-t border-rule pt-2">
          {shipping.links.map((link) => (
            <li key={link.path}>
              <a href={link.path} className="gf-link text-sm">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
