import { ArrowDown, CircleCheck } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { OrderPageView, Translate } from "@qticaret/ui"

/**
 * The order's opening, a graphite stage: fresh from checkout it thanks
 * the shopper, later it names the order; the order's number, date, way
 * of paying as plain facts, the confirmation's address, and
 * the first thing bought as a photograph sinking into the stage. While a
 * transfer waits, its one button leads down to the account to pay to
 * (below the first screen on a phone and a laptop), shopping on beside it.
 */
export function OrderHero({ view, t }: { view: OrderPageView; t: Translate }) {
  const picture = view.lines.find((line) => line.image)?.image ?? null
  const facts: [string, string][] = [
    [t("order.number"), `#${view.displayId}`],
    [t("order.placed_at"), view.placedAt],
    ...(view.payment ? ([[t("order.payment"), view.payment]] as [string, string][]) : []),
  ]
  return (
    <section
      aria-labelledby="siparis-baslik"
      className="gf-stage grid overflow-hidden rounded-tile lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]"
    >
      <div className="flex flex-col gap-6 p-6 sm:p-10 lg:py-12">
        {view.fresh && (
          <p role="status" className="flex items-center gap-2 text-md font-semibold">
            <CircleCheck className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            {t("order.received")}
          </p>
        )}
        <h1 id="siparis-baslik" className="max-w-[24ch]">
          {view.fresh ? t("order.thanks") : t("order.title", { id: view.displayId })}
        </h1>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {facts.map(([term, value]) => (
            <div key={term} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-sm text-stage-text-2">{term}</dt>
              <dd className="tabular text-md font-extrabold break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-stage-text-2">
          {t("order.confirmation_sent", { email: view.email })}
        </p>
        {view.bankTransfer ? (
          // A transfer waits: the shopper's next step is the account to pay to, below the stage
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="#havale" className="gf-btn">
              <ArrowDown className="size-4.5" aria-hidden="true" strokeWidth={2} />
              {t("order.bank_jump")}
            </a>
            <a href="/" className="gf-link">
              {t("cart.continue")}
            </a>
          </div>
        ) : (
          <a href="/" className="gf-btn self-start">
            {t("cart.continue")}
          </a>
        )}
      </div>
      {picture && (
        <div className="relative min-h-40 max-lg:order-first after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:via-stage/0 after:via-40% after:to-transparent sm:min-h-56 lg:min-h-full lg:after:bg-linear-to-r lg:after:via-30%">
          <ResponsiveImage
            image={{ ...picture, alt: "" }}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}
    </section>
  )
}
