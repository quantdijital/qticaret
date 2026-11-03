import { Fragment } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import { exclusionOf } from "@/features/orders/api/returns"
import type { RefusalReason, RefusedLine, ReturnRequest } from "@/features/orders/api/returns"
import { NonWithdrawableBadge } from "@/features/orders/components/non-withdrawable-badge"
import { refundDeadline, sealedLinesOf } from "@/features/orders/return-facts"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const R = "orders.returns"

/**
 * A sealed good (MSY md. 15/1-ç, adr/0032 Ek 2026-11-03): inside the
 * right of withdrawal while its protective seal is unopened; one that
 * comes back opened is refused at receipt. Its title says so in a sentence.
 */
export function SealedGoodsBadge() {
  const { t } = useTranslation()
  return (
    <span title={t("orders.sealedGoods.text")} className="inline-flex">
      <StatusBadge tone="info">{t("orders.sealedGoods.badge")}</StatusBadge>
    </span>
  )
}

/**
 * A request's marks before it is decided: a line outside the right of
 * withdrawal (back only faulty or wrong), a sealed good (refused if opened).
 */
export function RequestWithdrawalBadges({ request }: { request: Pick<ReturnRequest, "items"> }) {
  const exclusion = exclusionOf(request)
  return (
    <>
      {exclusion !== undefined ? <NonWithdrawableBadge reason={exclusion} /> : null}
      {sealedLinesOf(request).size > 0 ? <SealedGoodsBadge /> : null}
    </>
  )
}

/**
 * What the law's clock and the receipt say of a request (adr/0032 Ek
 * 2026-11-03): when the return carrier took the parcel, the last day to
 * pay it back while money is owed (red in its last 4 days and once past,
 * said in words too), and the units refused at receipt and why. `titles`:
 * the order's line names, to say which units; without them, how many.
 */
export function ReturnFacts({
  request,
  titles,
  className,
}: {
  request: ReturnRequest
  titles?: ReadonlyMap<string, string>
  className?: string
}) {
  const { t } = useTranslation()
  const facts: { key: string; node: ReactNode }[] = []
  if (request.handed_over_at) {
    facts.push({
      key: "handed",
      node: t(`${R}.facts.handedOver`, { date: formatDate(request.handed_over_at) }),
    })
  }
  const deadline = refundDeadline(request)
  if (deadline) {
    const date = formatDate(deadline.due_at)
    facts.push({
      key: "due",
      node: (
        <span
          data-state={deadline.state}
          className={cn(deadline.state !== "open" && "font-medium text-destructive-text")}
        >
          {deadline.state === "late"
            ? t(`${R}.facts.dueLate`, { date })
            : deadline.state === "near"
              ? t(`${R}.facts.dueNear`, { date, count: deadline.days_left })
              : t(`${R}.facts.due`, { date })}
        </span>
      ),
    })
  }
  const byReason = new Map<RefusalReason, RefusedLine[]>()
  for (const line of request.refused_items ?? []) {
    byReason.set(line.reason, [...(byReason.get(line.reason) ?? []), line])
  }
  for (const [reason, lines] of byReason) {
    const names = titles && lines.every((line) => titles.has(line.line_item_id)) ? titles : null
    facts.push({
      key: `refused-${reason}`,
      node: t(`${R}.facts.refused`, {
        reason: t(`${R}.refusalReasons.${reason}`),
        what: names
          ? lines
              .map((line) =>
                t(`${R}.facts.line`, {
                  name: names.get(line.line_item_id),
                  count: line.quantity,
                })
              )
              .join(", ")
          : t(`${R}.facts.units`, {
              count: lines.reduce((sum, line) => sum + line.quantity, 0),
            }),
      }),
    })
  }
  if (facts.length === 0) {
    return null
  }
  return (
    <span
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground",
        className
      )}
    >
      {facts.map((fact, index) => (
        <Fragment key={fact.key}>
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <span>{fact.node}</span>
        </Fragment>
      ))}
    </span>
  )
}
