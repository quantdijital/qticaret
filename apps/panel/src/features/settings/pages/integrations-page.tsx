import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  integrationHealthQuery,
  integrationOverviewQuery,
  useTestIntegration,
} from "@/features/settings/api/integrations"
import type { IntegrationView } from "@/features/settings/api/integrations"
import { IntegrationRow } from "@/features/settings/components/integration-row"
import { INTEGRATION_GROUPS } from "@/features/settings/integrations"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatRelative } from "@/lib/format"

const I = "settings.integrations"

/**
 * Settings > Integrations (F12.2, docs/06): every outside service the shop
 * uses, grouped; where each stands and why, whether it answers now, its
 * last failed calls, a connection test with the stored account and the
 * page it is set up on. No secret is shown or changed here.
 */
export function IntegrationsPage() {
  const { t } = useTranslation()
  const overview = useQuery(integrationOverviewQuery())
  const health = useQuery(integrationHealthQuery())
  const test = useTestIntegration()
  const report = health.data
  const rows = overview.data

  const runTest = (row: IntegrationView) => {
    const name = t(`${I}.names.${row.id}`, { defaultValue: row.id })
    test.mutate(row.id, {
      onSuccess: ({ check }) => {
        if (check === "valid") {
          toast.success(t(`${I}.tested.valid`, { name }))
        } else if (check === "unreachable") {
          toast.warning(t(`${I}.tested.unreachable`, { name }))
        } else {
          toast.error(t(`${I}.tested.${check ?? "failed"}`, { name }))
        }
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${I}.title`)}
        description={t(`${I}.subtitle`)}
        action={
          <Button
            variant="outline"
            disabled={health.isFetching || overview.isFetching}
            onClick={() => {
              void overview.refetch()
              void health.refetch()
            }}
          >
            <RefreshCw className={health.isFetching ? "animate-spin" : undefined} />
            {t(`${I}.health.refresh`)}
          </Button>
        }
      />
      {report ? (
        <p className="-mt-3 text-[13px] text-muted-foreground">
          {t(report.status === "ok" ? `${I}.health.all_ok` : `${I}.health.degraded`)}{" "}
          <time dateTime={report.checked_at} title={formatDateTime(report.checked_at)}>
            {t(`${I}.health.checked`, { when: formatRelative(report.checked_at) })}
          </time>
        </p>
      ) : null}
      {overview.isError ? (
        <ErrorState text={errorText(t, overview.error)} onRetry={() => void overview.refetch()} />
      ) : !rows ? (
        <LoadingRows rows={6} />
      ) : (
        INTEGRATION_GROUPS.map((group) => {
          const members = rows.filter((row) => row.group === group)
          return members.length === 0 ? null : (
            <SectionCard
              key={group}
              title={t(`${I}.groups.${group}.title`)}
              description={t(`${I}.groups.${group}.text`)}
              flush
            >
              <ul className="flex flex-col">
                {members.map((row) => (
                  <IntegrationRow
                    key={row.id}
                    row={row}
                    health={report?.checks.find((check) => check.id === row.id)}
                    testing={test.isPending && test.variables === row.id}
                    onTest={() => {
                      runTest(row)
                    }}
                  />
                ))}
              </ul>
            </SectionCard>
          )
        })
      )}
    </div>
  )
}
