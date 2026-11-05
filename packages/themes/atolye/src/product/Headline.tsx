import { Check, Truck } from "lucide-react"
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
 * the stars with the count leading to the reviews, then the shop's short
 * description as a quiet checked list (up to five lines, adr/0055 Ek
 * 2026-11-05) or, without one, up to four facts the shop marked as
 * headline ones.
 */
export function Headline({ view, t }: { view: ProductPageView; t: Translate }) {
  const [name = view.title, ...detail] = view.title.split(" | ")
  const summary = view.summary ?? []
  // The short description takes the facts' place; they stay on the spec table
  const facts = summary.length > 0 ? [] : view.specs.filter((spec) => spec.highlight).slice(0, 4)
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
      <h1 className="max-w-none">
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
      {summary.length > 0 && (
        <ul aria-label={t("product.summary")} className="flex max-w-[52ch] flex-col gap-1.5 pt-1">
          {summary.map((line, index) => (
            <li key={`${String(index)}-${line}`} className="flex items-start gap-2 text-sm">
              <Check
                className="mt-[0.2em] size-4 shrink-0 text-text-2"
                aria-hidden="true"
                strokeWidth={1.75}
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
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

/** Asking about this product on WhatsApp, when the shop gave a number. */
function AskOnWhatsApp({ href, t }: { href: string; t: Translate }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="gf-link self-start text-sm">
      <WhatsAppGlyph className="size-4 text-whatsapp" />
      {t("product.ask_whatsapp")}
    </a>
  )
}

/**
 * The shop's assurances beside the buy form. With the "Kargo ve Teslimat"
 * card below (a shipped product, owner 2026-11-05) the delivery and return
 * facts live there only: here, short, the shop's other promises (warranty,
 * safe payment), two to a row where the column allows, and the WhatsApp
 * question. Without the card, delivery and returns as plain facts on a
 * filled well: the free shipping line, every promise, the question.
 */
export function Delivery({ view, t }: { view: ProductPageView; t: Translate }) {
  const card = view.shipping ?? null
  if (card) {
    const told = new Set(card.facts.map((fact) => `${fact.icon} ${fact.title}`))
    const rest = view.trustBadges.filter((badge) => !told.has(`${badge.icon} ${badge.title}`))
    if (rest.length === 0 && !view.whatsappHref) {
      return null
    }
    return (
      <div className="flex flex-col gap-2 rounded-media bg-paper-2 px-4 pt-4 pb-2">
        {rest.length > 0 && (
          <ul
            aria-label={t("product.assurances")}
            className="grid gap-3 pb-2 text-sm @sm:grid-cols-2"
          >
            {rest.map((badge) => (
              <li key={badge.title} className="flex items-start gap-3">
                <TrustIcon icon={badge.icon} className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="font-semibold">{badge.title}</span>
                  {badge.text && <span className="block text-text-2">{badge.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {view.whatsappHref && <AskOnWhatsApp href={view.whatsappHref} t={t} />}
      </div>
    )
  }
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
      {view.whatsappHref && <AskOnWhatsApp href={view.whatsappHref} t={t} />}
    </section>
  )
}
