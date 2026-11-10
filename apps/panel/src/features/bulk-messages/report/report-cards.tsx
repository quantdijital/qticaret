import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatCard } from "@qticaret/admin-ui/patterns/stat-card"
import type { BulkReport } from "@/features/bulk-messages/api/types"
import { SKIP_REASONS } from "@/features/bulk-messages/api/types"
import { SkipList } from "@/features/bulk-messages/components/audience-count"
import { formatCount, formatMoney, formatPercent } from "@qticaret/admin-ui/lib/format"

const R = "bulkMessages.report"

const share = (part: number, whole: number) => (whole > 0 ? formatPercent(part / whole) : null)

/**
 * The campaign's numbers (adr/0050 §9): its audience, those it was fixed
 * to reach, sent, waiting, failed and skipped; for an e-mail, the bounces
 * and complaints Resend reported; the consents withdrawn within the week.
 */
export function ReportCounters({ report }: { report: BulkReport }) {
  const { t } = useTranslation()
  const { counts } = report
  const skipped = SKIP_REASONS.reduce((sum, reason) => sum + counts.skipped[reason], 0)
  const tiles: { key: string; value: number; hint?: string | null }[] = [
    { key: "audience", value: counts.audience },
    { key: "targeted", value: counts.targeted },
    { key: "sent", value: counts.sent, hint: share(counts.sent, counts.targeted) },
    { key: "pending", value: counts.pending },
    { key: "failed", value: counts.failed },
    { key: "skipped", value: skipped },
    ...(report.channel === "email"
      ? [
          { key: "bounces", value: counts.bounces, hint: share(counts.bounces, counts.sent) },
          {
            key: "complaints",
            value: counts.complaints,
            hint: share(counts.complaints, counts.sent),
          },
        ]
      : []),
    { key: "unsubscribed", value: counts.unsubscribed },
  ]
  return (
    <SectionCard title={t(`${R}.title`)} description={t(`${R}.description.${report.channel}`)}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <StatCard
            key={tile.key}
            label={t(`${R}.counts.${tile.key}`)}
            value={formatCount(tile.value)}
            {...(tile.hint ? { hint: t(`${R}.share`, { share: tile.hint }) } : {})}
          />
        ))}
      </dl>
    </SectionCard>
  )
}

/** Who got nothing and why, each reason in words: left out before it started or at send time. */
export function SkipCard({ report }: { report: BulkReport }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t(`${R}.skippedTitle`)} description={t(`${R}.skippedHint`)}>
      <SkipList counts={report.counts.skipped} label={t(`${R}.skippedTitle`)} />
    </SectionCard>
  )
}

/** What its links brought within the week (F11.2), counted by its `utm_campaign`, never by person. */
export function TrafficCard({ report }: { report: BulkReport }) {
  const { t } = useTranslation()
  const traffic = report.traffic
  return (
    <SectionCard
      title={t(`${R}.trafficTitle`)}
      description={t(`${R}.trafficHint`, { code: report.utm_campaign })}
    >
      {traffic ? (
        <dl className="grid grid-cols-3 gap-3">
          <StatCard label={t(`${R}.carts`)} value={formatCount(traffic.carts)} />
          <StatCard label={t(`${R}.orders`)} value={formatCount(traffic.orders)} />
          <StatCard label={t(`${R}.revenue`)} value={formatMoney(traffic.revenue, "try")} />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${R}.trafficNone`)}</p>
      )}
    </SectionCard>
  )
}
