import { ChevronDown, ShoppingBag } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CheckoutSummaryView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { LineAddons } from "../components/LineAddons"
import { LineName } from "../components/LineName"

/** The basket beside the checkout: lines with their pictures and counts, then the totals. */
export function OrderSummary({
  summary,
  t,
  className,
}: {
  summary: CheckoutSummaryView
  t: Translate
  className?: string
}) {
  return (
    <aside
      aria-labelledby="odeme-ozeti"
      className={cn(
        "flex h-fit flex-col gap-5 rounded-3xl border bg-card p-6 text-sm lg:sticky lg:top-40 lg:p-7",
        className
      )}
    >
      <h2 id="odeme-ozeti" className="text-2xl">
        {t("cart.summary")}
      </h2>
      <ul className="flex flex-col gap-4">
        {summary.lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3.5">
            <div className="relative size-16 shrink-0 rounded-xl border bg-muted/50">
              {line.image ? (
                <ResponsiveImage
                  image={line.image}
                  sizes="64px"
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="font-heading flex h-full items-center justify-center text-2xl text-foreground/15"
                >
                  {line.title.charAt(0).toLocaleUpperCase("tr")}
                </span>
              )}
              <span className="tabular absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                <span className="sr-only">{t("cart.quantity")}: </span>
                {line.quantity}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">
                <LineName path={line.path} title={line.title} />
              </span>
              {line.detail && (
                <span className="truncate text-xs text-muted-foreground">{line.detail}</span>
              )}
              <LineAddons addons={line.addons ?? []} className="mt-0.5" />
            </div>
            <span className="tabular shrink-0 font-medium">{line.total}</span>
          </li>
        ))}
      </ul>
      <dl className="tabular flex flex-col gap-3 border-t pt-5">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("cart.items")}</dt>
          <dd>{summary.items}</dd>
        </div>
        {summary.discount && (
          <div className="flex justify-between text-sale">
            <dt>{t("cart.discount")}</dt>
            <dd>−{summary.discount}</dd>
          </div>
        )}
        {summary.credit && (
          <div className="flex justify-between text-sale">
            <dt>{t("cart.gift_card_credit")}</dt>
            <dd>−{summary.credit}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("cart.shipping")}</dt>
          <dd className={summary.shipping ? undefined : "text-muted-foreground"}>
            {summary.shipping ?? t("checkout.shipping_next")}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t pt-4">
          <dt className="font-medium">{t("checkout.total")}</dt>
          <dd className="text-xl font-semibold">{summary.total}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{t("checkout.tax_included")}</p>
    </aside>
  )
}

/** On phones the basket folds above the steps: its total in sight, its lines a tap away. */
export function FoldedSummary({ summary, t }: { summary: CheckoutSummaryView; t: Translate }) {
  return (
    <details className="group rounded-3xl border bg-card lg:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 text-sm marker:hidden">
        <ShoppingBag className="size-4.5" aria-hidden="true" />
        <span className="flex-1 font-medium">{t("checkout.show_summary")}</span>
        <span className="tabular font-semibold">{summary.total}</span>
        <ChevronDown
          className="size-4 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <OrderSummary summary={summary} t={t} className="rounded-t-none border-x-0 border-b-0" />
    </details>
  )
}
