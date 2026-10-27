import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { integrationHealthQuery } from "@/features/settings/api/integrations"
import type { HealthCheck, HealthStatus } from "@/features/settings/api/integrations"
import { PAYMENT_METHODS } from "@/features/settings/payment-methods"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatRelative } from "@/lib/format"

const I = "settings.integrations"

const TONE: Record<HealthStatus, StatusTone> = {
  ok: "success",
  down: "danger",
  not_configured: "neutral",
}

/** Payment providers have their own page in Settings > Payment. */
const hasPaymentPage = (id: string) =>
  PAYMENT_METHODS.some((method) => method.id === id && !method.upcoming)

/** One dependency: what it is, whether it answers, and why not. */
function CheckRow({ check }: { check: HealthCheck }) {
  const { t } = useTranslation()
  const nameId = `integration-${check.id}`
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-5 py-4">
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
        <span id={nameId} className="text-sm font-medium">
          {t(`${I}.checks.${check.id}`, { defaultValue: check.id })}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {check.status === "down"
            ? t(`${I}.reasons.${check.reason ?? "error"}`, {
                defaultValue: t(`${I}.reasons.error`),
              })
            : t(`${I}.kinds.${check.kind}`, { defaultValue: check.kind })}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {check.status === "not_configured" ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t(`${I}.latency`, { ms: check.latency_ms })}
          </span>
        )}
        <StatusBadge tone={TONE[check.status]}>{t(`${I}.status.${check.status}`)}</StatusBadge>
        {hasPaymentPage(check.id) ? (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/settings/payments/$provider"
              params={{ provider: check.id }}
              aria-describedby={nameId}
            >
              {t(`${I}.manage`)}
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Settings > Integrations (F5 V7, docs/06): whether every outside service
 * the shop depends on answers right now. Accounts are set up on their own
 * pages; this one only reports.
 */
export function IntegrationsPage() {
  const { t } = useTranslation()
  const query = useQuery(integrationHealthQuery())
  const report = query.data
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${I}.title`)} description={t(`${I}.subtitle`)} />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !report ? (
        <LoadingRows rows={4} />
      ) : (
        <SectionCard
          title={t(`${I}.health.title`)}
          description={t(report.status === "ok" ? `${I}.health.all_ok` : `${I}.health.degraded`)}
          action={
            <>
              <time
                dateTime={report.checked_at}
                title={formatDateTime(report.checked_at)}
                className="text-xs text-muted-foreground"
              >
                {t(`${I}.health.checked`, { when: formatRelative(report.checked_at) })}
              </time>
              <Button
                variant="outline"
                size="sm"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
                {t(`${I}.health.refresh`)}
              </Button>
            </>
          }
          flush
        >
          <ul className="flex flex-col">
            {report.checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}
