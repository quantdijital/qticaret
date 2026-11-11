import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { formatDateTime, formatPercent, formatRelative } from "@qticaret/admin-ui/lib/format"
import { limitText } from "@/features/packages/format"
import type { TenantDetail } from "@/features/tenants/api"
import type { UsageHealth } from "../api"
import { USE_TONES, usageRows } from "../rules"
import type { UseRow } from "../rules"

// The bar's colour follows its tone; the words beside it say the same
const BAR: Record<UseRow["tone"], string> = {
  ok: "",
  warn: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
  full: "bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive",
  over: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
}

function UseLine({ row }: { row: UseRow }) {
  const { t } = useTranslation()
  const name = t(`limits.keys.${row.key}`)
  const used = row.used === null ? null : limitText(t, row.key, row.used)
  const amount =
    used === null
      ? t("usage.notReported")
      : row.limit === null
        ? t("usage.unlimited", { used })
        : t("usage.of", { used, limit: limitText(t, row.key, row.limit) })
  return (
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{name}</span>
        <span className="flex items-center gap-2">
          {row.tone === "ok" ? null : (
            <StatusBadge tone={USE_TONES[row.tone]}>{t(`usage.tone.${row.tone}`)}</StatusBadge>
          )}
          <span className="text-sm tabular-nums text-muted-foreground">{amount}</span>
        </span>
      </div>
      {row.ratio === null ? null : (
        <Progress
          value={Math.round(row.ratio * 100)}
          aria-label={t("usage.barLabel", { name, value: formatPercent(row.ratio) })}
          className={cn("h-1.5", BAR[row.tone])}
        />
      )}
    </li>
  )
}

/**
 * The shop's use against what it may use (adr/0061 §5.3–5.4, Ek C13):
 * a bar per limit from its last hourly report (amber from 80 %, red at a
 * limit that blocks; the month's orders only warn), then its last order,
 * the release it runs and when it last reported. Three hours without a
 * report while it should send one: "Rapor gelmiyor", a warning.
 */
export function UsageCard({ shop, data }: { shop: TenantDetail; data: UsageHealth }) {
  const { t } = useTranslation()
  const usage = data.usage
  const customDomains = shop.domains.filter((domain) => domain.kind === "custom").length
  const rows = usageRows(shop.limits, usage?.counts ?? null, customDomains)
  const facts: [string, string][] = usage
    ? [
        [t("usage.facts.period"), usage.period],
        [
          t("usage.facts.lastOrder"),
          usage.last_order_at ? formatDateTime(usage.last_order_at) : t("usage.facts.noOrder"),
        ],
        [
          t("usage.facts.release"),
          `${usage.release.version} · ${usage.release.commit.slice(0, 12)}`,
        ],
        [
          t("usage.facts.reportedAt"),
          `${formatRelative(usage.received_at)} · ${formatDateTime(usage.received_at)}`,
        ],
      ]
    : []
  return (
    <SectionCard
      title={t("usage.title")}
      description={
        usage ? t("usage.text") : t(data.report.expected ? "usage.none" : "usage.notYet")
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {data.report.missing ? (
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              {usage
                ? t("usage.missing", { hours: data.report.missing_after_hours })
                : t("usage.missingNever")}
            </AlertDescription>
          </Alert>
        ) : null}
        <ul aria-label={t("usage.listLabel")} className="flex flex-col divide-y">
          {rows.map((row) => (
            <UseLine key={row.key} row={row} />
          ))}
        </ul>
        {facts.length > 0 ? (
          <dl className="mt-auto grid gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 truncate tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </SectionCard>
  )
}
