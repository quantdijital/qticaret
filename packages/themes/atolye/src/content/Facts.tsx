import { Banknote, Landmark } from "lucide-react"
import type {
  InstallmentRatesView,
  PaymentFactsView,
  ShippingFactsView,
  ShopMarkView,
  Translate,
} from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { TrustIcon } from "../parts/TrustIcon"

/** Ways to pay with no company's mark: an icon beside their name. */
const ICONS: Record<string, typeof Landmark> = {
  bank_transfer: Landmark,
  cash_on_delivery: Banknote,
}

/** The providers' own marks, each on a light chip of one height. */
function Marks({ marks }: { marks: readonly ShopMarkView[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {marks.map((mark) => {
        const Icon = ICONS[mark.key]
        return (
          <li
            key={mark.key}
            className="flex h-12 items-center gap-2 rounded-inner border border-rule bg-chip px-4 text-sm font-semibold text-stage"
          >
            {mark.logo ? (
              <img
                src={mark.logo.src}
                alt={mark.label}
                width={mark.logo.width}
                height={mark.logo.height}
                loading="lazy"
                decoding="async"
                className="h-6 w-auto"
              />
            ) : (
              <>
                {Icon && <Icon className="size-5" aria-hidden="true" strokeWidth={1.75} />}
                {mark.label}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Every installment count any family offers, in order. */
const countsOf = (families: readonly InstallmentRatesView[]): number[] =>
  [...new Set(families.flatMap((family) => family.options.map((option) => option.count)))].sort(
    (a, b) => a - b
  )

/** The ways to pay the shop offers now, on a filled well beside the payment page's text. */
export function PaymentMarks({ marks, t }: { marks: readonly ShopMarkView[]; t: Translate }) {
  return (
    <section
      aria-labelledby="odeme-yontemleri"
      className="flex flex-col gap-4 rounded-tile bg-paper-2 p-6 lg:p-8"
    >
      <h2 id="odeme-yontemleri" className="text-title">
        {t("content.payments")}
      </h2>
      <Marks marks={marks} />
    </section>
  )
}

/**
 * The card families' rates as one real table: a row per number of
 * installments, a column per card family, as the provider prices them
 * today; the count stays in view while a phone scrolls the families
 * sideways (the box is one tab stop, docs/19 §6.9).
 */
export function InstallmentTable({ facts, t }: { facts: PaymentFactsView; t: Translate }) {
  const families = facts.installments
  const counts = countsOf(families)
  return (
    <section className="flex flex-col gap-5">
      <div className="flex max-w-[68ch] flex-col gap-2">
        <h2
          id="taksit-secenekleri"
          className="text-[calc(var(--text-title)*1.2)] tracking-[-0.02em]"
        >
          {t("content.installments")}
        </h2>
        {facts.maxInstallments !== null && (
          <p className="text-text-2">
            {t("content.installments_text", { count: facts.maxInstallments })}
          </p>
        )}
      </div>
      <div
        role="region"
        aria-labelledby="taksit-secenekleri"
        tabIndex={0}
        className="-mx-(--gutter) overflow-x-auto px-(--gutter) lg:mx-0 lg:px-0"
      >
        <table className="tabular w-full min-w-max border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-text">
              <th scope="col" className="sticky left-0 bg-paper py-3 pr-6 font-extrabold">
                {t("content.installment_count")}
              </th>
              {families.map((family) => (
                <th key={family.family} scope="col" className="px-4 py-3 text-right font-extrabold">
                  {family.family}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {counts.map((count) => (
              <tr key={count} className="border-b border-rule">
                <th scope="row" className="sticky left-0 bg-paper py-2.5 pr-6 font-semibold">
                  {t("content.installment_n", { count })}
                </th>
                {families.map((family) => {
                  const option = family.options.find((each) => each.count === count)
                  return (
                    <td
                      key={family.family}
                      className={cn(
                        "px-4 py-2.5 text-right",
                        option?.free && "font-semibold text-ok"
                      )}
                    >
                      {option ? option.rate : t("content.rate_none")}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** The shipping page's facts beside its text: the shop's promises, then its carriers' own marks. */
export function ShippingFacts({ facts, t }: { facts: ShippingFactsView; t: Translate }) {
  return (
    <div className="flex flex-col gap-(--gap-columns)">
      {facts.promises.length > 0 && (
        <section
          aria-labelledby="guvencelerimiz"
          className="flex flex-col gap-4 rounded-tile bg-paper-2 p-6 lg:p-8"
        >
          <h2 id="guvencelerimiz" className="text-title">
            {t("content.promises")}
          </h2>
          <ul className="flex flex-col gap-4">
            {facts.promises.map((promise) => (
              <li key={promise.title} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-paper">
                  <TrustIcon icon={promise.icon} className="size-5" />
                </span>
                <span className="flex flex-col pt-1.5">
                  <span className="font-semibold">{promise.title}</span>
                  {promise.text && <span className="text-sm text-text-2">{promise.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {facts.carriers.length > 0 && (
        <section
          aria-labelledby="kargo-firmalari"
          className="flex flex-col gap-4 rounded-tile bg-paper-2 p-6 lg:p-8"
        >
          <h2 id="kargo-firmalari" className="text-title">
            {t("content.carriers")}
          </h2>
          <Marks marks={facts.carriers} />
        </section>
      )}
    </div>
  )
}
