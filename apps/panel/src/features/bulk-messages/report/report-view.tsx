import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PageGrid, PageColumn } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { bulkReportQuery } from "@/features/bulk-messages/api/bulk-messages"
import type { BulkMessage } from "@/features/bulk-messages/api/types"
import { BulkActions } from "@/features/bulk-messages/components/bulk-actions"
import { BulkStatusBadge } from "@/features/bulk-messages/components/bulk-status"
import { statusNote } from "@/features/bulk-messages/components/status-note"
import { LineTabs } from "@/features/bulk-messages/components/line-tabs"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { ContentSummary } from "./content-summary"
import { ReportCounters, SkipCard, TrafficCard } from "./report-cards"

const R = "bulkMessages.report"

type Tab = "report" | "content"

/** The report's numbers, or why there are none yet (a scheduled campaign). */
function ReportBody({ campaign }: { campaign: BulkMessage }) {
  const { t } = useTranslation()
  const report = useQuery(bulkReportQuery(campaign.id, campaign.status === "sending"))
  if (report.isError && !report.data) {
    return <ErrorState text={errorText(t, report.error)} onRetry={() => void report.refetch()} />
  }
  if (!report.data) {
    return <LoadingRows rows={6} />
  }
  if (!report.data.started_at) {
    return (
      <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-card">
        {campaign.scheduled_at
          ? t(`${R}.notStartedAt`, { when: formatDateTime(campaign.scheduled_at) })
          : t(`${R}.notStarted`)}
      </section>
    )
  }
  return (
    <>
      <ReportCounters report={report.data} />
      <PageGrid>
        <PageColumn span={6}>
          <SkipCard report={report.data} />
        </PageColumn>
        <PageColumn span={6}>
          <TrafficCard report={report.data} />
        </PageColumn>
      </PageGrid>
    </>
  )
}

/**
 * A campaign past its draft (adr/0050 §9–10): where it stands and why it
 * waits, its numbers while it sends and after, and what went, read only;
 * pause, resume, cancel and copy beside the title.
 */
export function BulkReportView({ campaign }: { campaign: BulkMessage }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("report")
  // The report is read again while it sends: its state is the newest one
  const report = useQuery({
    ...bulkReportQuery(campaign.id, campaign.status === "sending"),
    enabled: false,
  })
  const current: BulkMessage = report.data
    ? { ...campaign, status: report.data.status, paused_reason: report.data.paused_reason }
    : campaign
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        back={{ to: "/bulk-messages", label: t("bulkMessages.title") }}
        title={campaign.name}
        description={statusNote(t, current) ?? undefined}
        badge={<BulkStatusBadge status={current.status} />}
        action={<BulkActions campaign={current} />}
      />
      <LineTabs
        label={campaign.name}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "report", label: t(`${R}.tab`), content: <ReportBody campaign={current} /> },
          {
            key: "content",
            label: t("bulkMessages.locked.tab"),
            content: <ContentSummary campaign={current} />,
          },
        ]}
      />
    </div>
  )
}
