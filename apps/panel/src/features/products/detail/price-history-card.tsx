import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { CircleCheck, Info, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { StepChart } from "@/components/charts/step-chart"
import { SectionCard } from "@/components/patterns/section-card"
import { EmptyState, ErrorState } from "@/components/patterns/states"
import type { SectionFindings } from "@/features/content/section-findings"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { priceHistoryQuery } from "@/features/products/api/price-history"
import type {
  PriceDisplayView,
  PriceHistory,
  VariantPriceHistory,
} from "@/features/products/api/price-history"
import { priceSteps, ruleState } from "@/features/products/price-history"
import { errorText } from "@/lib/errors"
import { formatBucket, formatCompactMoney, formatDate, formatMoney } from "@/lib/format"
import { productFold } from "./sections"

const CURRENCY = "try"

// The price moved in the window: something for a line to show
const changed = (steps: readonly { paid: number; regular: number }[]): boolean => {
  const first = steps[0]
  return (
    first !== undefined &&
    steps.some((step) => step.paid !== first.paid || step.regular !== first.regular)
  )
}

// The rule's window when the answer does not say it (Fiyat Etiketi Yönetmeliği md. 11/1, 2025)
const WINDOW_DAYS = 10

/** What the price-before rule makes of today's price, said with an icon as well as a colour. */
function RuleNotice({ display, days }: { display: PriceDisplayView | null; days: number }) {
  const { t } = useTranslation()
  const money = (amount: string) => formatMoney(amount, CURRENCY)
  if (!display) {
    return <p className="text-sm text-muted-foreground">{t("products.priceHistory.unpriced")}</p>
  }
  const state = ruleState(display)
  if (state === "none") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("products.priceHistory.none", { price: money(display.current) })}
      </p>
    )
  }
  const struck = state === "struck"
  const Icon = struck ? CircleCheck : TriangleAlert
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon
        aria-hidden="true"
        className={struck ? "mt-0.5 size-4 text-success-text" : "mt-0.5 size-4 text-warning-text"}
      />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">
          {t(struck ? "products.priceHistory.struck" : "products.priceHistory.blocked")}
        </p>
        <p className="text-muted-foreground">
          {struck
            ? t("products.priceHistory.struckDetail", {
                before: money(display.before ?? display.regular),
                price: money(display.current),
              })
            : t("products.priceHistory.blockedDetail", {
                days,
                lowest: money(display.lowest_before ?? display.current),
                price: money(display.current),
              })}
        </p>
        {struck && display.basis === "regular" ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info aria-hidden="true" className="size-3.5" />
            {t("products.priceHistory.regularBasis")}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * What the price-before rule makes of today's prices, in one line: the
 * variants whose discount is struck through and those whose is not.
 */
function historyLine(t: TFunction, history: PriceHistory | undefined): string | undefined {
  if (!history) {
    return undefined
  }
  const states = history.variants.flatMap((variant) =>
    variant.display ? [ruleState(variant.display)] : []
  )
  if (states.length === 0) {
    return t("products.sections.unpriced")
  }
  const one = history.variants.length === 1
  const struck = states.filter((state) => state === "struck").length
  const blocked = states.filter((state) => state === "blocked").length
  const parts = [
    struck > 0
      ? one
        ? t("products.sections.struck")
        : t("products.sections.struckIn", { count: struck })
      : undefined,
    blocked > 0
      ? one
        ? t("products.sections.blocked")
        : t("products.sections.blockedIn", { count: blocked })
      : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : t("products.sections.noDiscount")
}

function VariantPicker({
  variants,
  value,
  onChange,
}: {
  variants: VariantPriceHistory[]
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={t("products.priceHistory.variant")} className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {variants.map((variant) => (
          <SelectItem key={variant.id} value={variant.id}>
            {[variant.title, variant.sku].filter(Boolean).join(" · ") || variant.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * A product's price over the last 90 days (F4.3, ADR-0023): what was paid
 * against the price without a sale, and whether today's discount may be
 * struck through in the storefront under the price-before rule (the
 * lowest price of the days before it), and why not. With `fold`, folded
 * under the product page's main parts to that rule's verdict.
 */
export function PriceHistoryCard({
  productId,
  fold,
}: {
  productId: string
  /** The advisor's findings for it: folded, counted in its line, an urgent one opens it. */
  fold?: SectionFindings
}) {
  const { t } = useTranslation()
  const history = useQuery(priceHistoryQuery(productId, CURRENCY))
  const [picked, setPicked] = useState<string | null>(null)
  const variants = history.data?.variants ?? []
  const variant = variants.find((each) => each.id === picked) ?? variants[0]
  // Fixed once mounted: the line's right edge, not a new chart each render
  const [now] = useState(() => new Date())
  const start = history.data ? new Date(history.data.window_start).getTime() : now.getTime()
  const steps = variant ? priceSteps(variant.points, variant.display, now) : []
  const days = history.data?.window_days ?? WINDOW_DAYS
  return (
    <SectionCard
      title={t("products.priceHistory.title")}
      description={t("products.priceHistory.hint", { days })}
      action={
        variant && variants.length > 1 ? (
          <VariantPicker variants={variants} value={variant.id} onChange={setPicked} />
        ) : null
      }
      collapse={fold && productFold(t, "priceHistory", fold, [historyLine(t, history.data)])}
    >
      {history.isError && !history.data ? (
        <ErrorState text={errorText(t, history.error)} onRetry={() => void history.refetch()} />
      ) : !history.data ? (
        <Skeleton className="h-64 rounded-md" />
      ) : !variant || steps.length === 0 ? (
        <EmptyState text={t("products.priceHistory.empty")} />
      ) : !changed(steps) ? (
        // dataviz: a line that never moves says less than a sentence
        <div className="flex flex-col gap-2">
          <RuleNotice display={variant.display} days={days} />
          <p className="text-sm text-muted-foreground">{t("products.priceHistory.unchanged")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <RuleNotice display={variant.display} days={days} />
          <StepChart
            data={steps.map((step) => ({
              at: step.at,
              value: step.paid,
              reference: step.regular,
            }))}
            domain={[start, now.getTime()]}
            names={{
              value: t("products.priceHistory.paid"),
              reference: t("products.priceHistory.regular"),
            }}
            formatValue={(value) => formatMoney(value, CURRENCY)}
            formatTick={(value) => formatCompactMoney(value, CURRENCY)}
            formatTime={(at) => formatBucket(new Date(at).toISOString(), "day")}
            tableCaption={t("products.priceHistory.table", {
              from: formatDate(new Date(start)),
            })}
          />
        </div>
      )}
    </SectionCard>
  )
}
