import { CalendarRange, Check, Minus, Receipt, RefreshCw, Tag } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { PackageFeature, PaymentRecord, PlanSummary } from "@/features/settings/api/plan"
import { periodLabel } from "@/features/settings/subscription-rules"

/** The platform flags the page can name; a key it does not know yet is left out, not shown raw. */
const FEATURE_NAMES: Record<string, string> = {
  "catalog.product_videos": "productVideos",
  "ai.own_keys": "aiOwnKeys",
}

/** The package's features the page names, in the order the backend gives them. */
const namedFeatures = (features: readonly PackageFeature[] | undefined): PackageFeature[] =>
  (features ?? []).filter((feature) => Object.hasOwn(FEATURE_NAMES, feature.key))

function Fact({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
        {hint ? <InfoTip name={label} hint={hint} /> : null}
      </dt>
      <dd className="text-[14px] leading-5 font-medium break-words tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * The package card's footer (adr/0061 Ek C16, C20): the billing cycle,
 * the package's price, the last payment made and the month the monthly
 * limits count, four facts in one row from a tablet (two by two on a
 * phone); under them what the package includes. A fact the platform has
 * not sent reads "—", never a guess.
 */
export function PlanFacts({
  plan,
  lastPayment,
}: {
  plan: PlanSummary
  /** Undefined while the payments load or when they cannot be read. */
  lastPayment: PaymentRecord | null | undefined
}) {
  const { t } = useTranslation()
  const billing = plan.billing
  const cycle = billing?.period ?? null
  const price =
    billing?.price === null || billing?.price === undefined || !cycle
      ? null
      : `${formatMoney(billing.price / 100, billing.currency)} ${t(`plan.hero.per.${cycle}`)}`
  const features = namedFeatures(plan.features)
  return (
    <div className="flex flex-col gap-4 border-t bg-muted/40 px-5 py-4 sm:px-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <Fact icon={RefreshCw} label={t("plan.details.cycle")}>
          {cycle ? t(`plan.details.cycleOf.${cycle}`) : "—"}
        </Fact>
        <Fact icon={Tag} label={t("plan.details.price")}>
          {price ?? "—"}
        </Fact>
        <Fact icon={Receipt} label={t("plan.details.lastPayment")}>
          {lastPayment ? (
            <>
              {formatDate(lastPayment.paid_on ?? lastPayment.due_on)}
              <span className="block text-[12px] font-normal text-muted-foreground">
                {formatMoney(lastPayment.amount / 100, lastPayment.currency)}
              </span>
            </>
          ) : lastPayment === null ? (
            t("plan.details.noPayment")
          ) : (
            "—"
          )}
        </Fact>
        <Fact
          icon={CalendarRange}
          label={t("plan.details.usageMonth")}
          hint={t("plan.details.usageMonthHint")}
        >
          {periodLabel(plan.period)}
        </Fact>
      </dl>
      {features.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t("plan.details.includes")}
          </span>
          <ul aria-label={t("plan.details.includes")} className="flex flex-wrap gap-2">
            {features.map((feature) => {
              const name = t(`plan.details.feature.${FEATURE_NAMES[feature.key]}`)
              return (
                <li
                  key={feature.key}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium",
                    feature.enabled ? "bg-background" : "border-dashed text-muted-foreground"
                  )}
                >
                  {feature.enabled ? (
                    <Check className="size-3.5 text-success" aria-hidden="true" />
                  ) : (
                    <Minus className="size-3.5" aria-hidden="true" />
                  )}
                  {name}
                  <span className="sr-only">
                    {feature.enabled ? t("plan.details.included") : t("plan.details.notIncluded")}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
