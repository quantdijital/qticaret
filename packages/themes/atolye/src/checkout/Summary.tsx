import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CheckoutSummaryView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { LineAddons } from "../parts/LineAddons"
import { LineName, LinePhoto } from "../parts/LineLink"

function Lines({ summary, t }: { summary: CheckoutSummaryView; t: Translate }) {
  return (
    <ul className="flex flex-col gap-4">
      {summary.lines.map((line) => (
        <li key={line.id} className="flex items-start gap-3">
          <div className="relative size-16 shrink-0">
            <LinePhoto
              path={line.path}
              className="size-16 overflow-hidden rounded-inner bg-stage-2"
            >
              {line.image && (
                <ResponsiveImage
                  image={{ ...line.image, alt: "" }}
                  sizes="64px"
                  className="h-full w-full object-cover"
                />
              )}
            </LinePhoto>
            <span className="tabular absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-pill bg-stage-text text-xs font-extrabold text-stage">
              <span className="sr-only">{t("cart.quantity")}: </span>
              {line.quantity}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <span className="line-clamp-2 leading-snug font-semibold">
              <LineName path={line.path} title={line.title} />
            </span>
            {line.detail && line.detail.trim() !== line.title.trim() && (
              <span className="text-stage-text-2">{line.detail}</span>
            )}
            <LineAddons addons={line.addons ?? []} stage className="mt-1" />
          </div>
          <span className="tabular shrink-0 text-sm font-semibold">{line.total}</span>
        </li>
      ))}
    </ul>
  )
}

function Totals({ summary, t }: { summary: CheckoutSummaryView; t: Translate }) {
  const row = "flex items-baseline justify-between gap-4"
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      <div className={row}>
        <dt className="text-stage-text-2">{t(summary.tax ? "cart.items_net" : "cart.items")}</dt>
        <dd className="tabular">{summary.tax?.items ?? summary.items}</dd>
      </div>
      {summary.discount && (
        <div className={cn(row, "text-deal")}>
          <dt>{t("cart.discount")}</dt>
          <dd className="tabular">−{summary.discount}</dd>
        </div>
      )}
      {summary.credit && (
        <div className={cn(row, "text-deal")}>
          <dt>{t("cart.gift_card_credit")}</dt>
          <dd className="tabular">−{summary.credit}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-stage-text-2">{t("cart.shipping")}</dt>
        <dd className={cn("tabular", !summary.shipping && "text-stage-text-2")}>
          {summary.shipping ?? t("checkout.shipping_next")}
        </dd>
      </div>
      {summary.tax && (
        <div className={row}>
          <dt className="text-stage-text-2">{t("cart.vat")}</dt>
          <dd className="tabular">{summary.tax.vat}</dd>
        </div>
      )}
      <div className={cn(row, "mt-3 border-t border-stage-rule pt-4")}>
        <dt className="text-md font-semibold">{t("checkout.total")}</dt>
        <dd className="tabular text-title font-extrabold">{summary.total}</dd>
      </div>
    </dl>
  )
}

/**
 * The basket beside the checkout as a graphite stage, its photographs
 * sinking into it: each line with its count, picks (a gift wrap, an
 * engraving) and total, then the totals, the total large. The backend's
 * amounts in words; nothing is added up here. A wholesaler's: lines and
 * items without KDV, the KDV a row of its own (ADR-0068 §5).
 */
export function Summary({
  summary,
  t,
  code,
  className,
}: {
  summary: CheckoutSummaryView
  t: Translate
  /** The code field under the lines (the checkout's; the card form's page has none). */
  code?: ReactNode
  className?: string
}) {
  return (
    <aside
      aria-labelledby="odeme-ozeti"
      className={cn(
        "gf-stage flex h-fit flex-col gap-6 rounded-tile p-6 lg:sticky lg:top-6 lg:p-7",
        className
      )}
    >
      <h2 id="odeme-ozeti" className="text-title">
        {t("cart.summary")}
      </h2>
      <Lines summary={summary} t={t} />
      {code}
      <Totals summary={summary} t={t} />
      <p className="text-xs text-stage-text-2">{summary.tax?.note ?? t("checkout.tax_included")}</p>
    </aside>
  )
}

/**
 * On a phone the basket folds above the steps, a graphite bar with the
 * total in sight; opened, its lines, the code field and totals. Closed,
 * it takes no room below its bar.
 */
export function FoldedSummary({
  summary,
  t,
  code,
}: {
  summary: CheckoutSummaryView
  t: Translate
  code?: ReactNode
}) {
  return (
    <details className="gf-stage group rounded-tile lg:hidden">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-5 text-sm">
        <span className="flex-1 font-semibold">{t("checkout.show_summary")}</span>
        <span className="tabular text-md font-extrabold">{summary.total}</span>
        <ChevronDown
          className="size-4.5 shrink-0 transition-transform duration-(--dur-short) group-open:rotate-180"
          aria-hidden="true"
          strokeWidth={2}
        />
      </summary>
      <div className="flex flex-col gap-6 px-5 pt-2 pb-6">
        <Lines summary={summary} t={t} />
        {code}
        <Totals summary={summary} t={t} />
      </div>
    </details>
  )
}
