import type { ProductPageView, Translate } from "@qticaret/ui"
import { Stars } from "../parts/Stars"
import { Summary } from "./Summary"

/** A rating as the shop's language writes it: "4,6". */
export const ratingText = (average: number) => average.toFixed(1).replace(".", ",")

/**
 * The buy column's head: the brand small (its page), the name as the
 * page's one h1 (a name the shop wrote as "name | detail" keeps the
 * detail on a second, smaller line of the same heading), the subtitle,
 * the stars with the count leading to the reviews, then the shop's short
 * description as it wrote it (adr/0055 Ek 2026-11-06) or, without one, up
 * to four facts the shop marked as headline ones.
 */
export function Headline({ view, t }: { view: ProductPageView; t: Translate }) {
  const [name = view.title, ...detail] = view.title.split(" | ")
  const summary = view.summaryHtml ?? null
  // The short description takes the facts' place; they stay on the spec table
  const facts = summary ? [] : view.specs.filter((spec) => spec.highlight).slice(0, 4)
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
      {summary && <Summary html={summary} />}
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
