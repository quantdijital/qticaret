import { Truck } from "lucide-react"
import type { ProductPageView, Translate } from "@qticaret/ui"
import { Stars } from "../parts/Stars"
import { TrustIcon } from "../parts/TrustIcon"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"

/** A rating as the shop's language writes it: "4,6". */
export const ratingText = (average: number) => average.toFixed(1).replace(".", ",")

/**
 * The buy column's head: the brand small (its page), the name as the
 * page's one h1 (a name the shop wrote as "name | detail" keeps the
 * detail on a second, smaller line of the same heading), the subtitle,
 * the stars with the count leading to the reviews, and up to four facts
 * the shop marked as headline ones.
 */
export function Headline({ view, t }: { view: ProductPageView; t: Translate }) {
  const [name = view.title, ...detail] = view.title.split(" | ")
  const facts = view.specs.filter((spec) => spec.highlight).slice(0, 4)
  const { average, count } = view.reviews
  return (
    <header className="flex flex-col gap-3">
      {view.brand && (
        <a
          href={view.brand.path}
          className="-my-3 inline-flex min-h-11 items-center self-start text-sm font-semibold text-text-2 no-underline underline-offset-4 hover:underline"
        >
          {view.brand.label}
        </a>
      )}
      <h1 className="max-w-[24ch] text-[clamp(1.75rem,1.1vw+1.45rem,2.5rem)] leading-[1.08]">
        {name}
        {detail.length > 0 && (
          <span className="mt-2 block text-title leading-snug tracking-[-0.01em]">
            {detail.join(" | ")}
          </span>
        )}
      </h1>
      {view.subtitle && <p className="text-md text-text-2">{view.subtitle}</p>}
      {average !== null && count > 0 && (
        <a
          href="#degerlendirmeler"
          className="flex min-h-11 items-center gap-2 self-start text-sm no-underline"
        >
          <Stars rating={average} />
          <span className="tabular font-extrabold">{ratingText(average)}</span>
          <span className="text-text-2 underline underline-offset-4">
            {t("reviews.count", { count })}
          </span>
          <span className="sr-only">{t("product.average", { value: ratingText(average) })}</span>
        </a>
      )}
      {facts.length > 0 && (
        <dl aria-label={t("product.highlights")} className="flex flex-wrap gap-2 pt-1">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-pill bg-paper-2 px-3 py-1.5 text-xs">
              <dt className="inline text-text-2">{fact.label}: </dt>
              <dd className="inline font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}

/**
 * Delivery and returns as plain facts on a filled well: the shop's free
 * shipping line, its promises (the trust badges it wrote), and a chat
 * about this product on WhatsApp when the shop gave a number.
 */
export function Delivery({ view, t }: { view: ProductPageView; t: Translate }) {
  if (!view.shippingNote && view.trustBadges.length === 0 && !view.whatsappHref) {
    return null
  }
  return (
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
      {view.whatsappHref && (
        <a
          href={view.whatsappHref}
          target="_blank"
          rel="noopener"
          className="gf-link self-start text-sm"
        >
          <WhatsAppGlyph className="size-4 text-whatsapp" />
          {t("product.ask_whatsapp")}
        </a>
      )}
    </section>
  )
}
