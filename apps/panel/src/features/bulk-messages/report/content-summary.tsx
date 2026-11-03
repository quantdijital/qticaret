import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import type { AudienceSource, BulkMessage } from "@/features/bulk-messages/api/types"
import { customerGroupsQuery, customerSegmentsQuery } from "@/features/customers/api/groups"
import { docText } from "@/features/content/doc-text"
import { formatDateTime } from "@/lib/format"

const C = "bulkMessages.locked"

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t py-3 first:border-t-0 first:pt-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

/** The sources by name; a segment or group since removed by its kind alone. */
function useSourceNames(): (source: AudienceSource) => string {
  const { t } = useTranslation()
  const segments = useQuery(customerSegmentsQuery())
  const groups = useQuery(customerGroupsQuery())
  return (source) => {
    if (source.kind === "all_consented" || source.kind === "newsletter") {
      return t(`bulkMessages.audience.${source.kind}`)
    }
    const named =
      source.kind === "segment"
        ? segments.data?.find((segment) => segment.id === source.id)?.name
        : groups.data?.find((group) => group.id === source.id)?.name
    return `${t(`bulkMessages.audience.kinds.${source.kind}`)}: ${named ?? "—"}`
  }
}

/**
 * What went, read only (adr/0050 §2): once scheduled or sending, the
 * content is what the person approved; a change is made on a copy.
 */
export function ContentSummary({ campaign }: { campaign: BulkMessage }) {
  const { t } = useTranslation()
  const nameOf = useSourceNames()
  const rows: { key: string; value: string | null }[] =
    campaign.channel === "sms"
      ? [{ key: "smsText", value: campaign.sms_text }]
      : [
          { key: "subject", value: campaign.subject },
          { key: "preheader", value: campaign.preheader },
          { key: "body", value: campaign.body ? docText(campaign.body) : null },
        ]
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      <dl className="flex flex-col">
        <Row label={t("bulkMessages.fields.channel")}>
          {t(`bulkMessages.channels.${campaign.channel}`)}
        </Row>
        <Row label={t("bulkMessages.audience.title")}>
          {campaign.audience.map(nameOf).join(" · ")}
        </Row>
        {rows.map((row) => (
          <Row key={row.key} label={t(`${C}.fields.${row.key}`)}>
            {row.value ?? "—"}
          </Row>
        ))}
        <Row label={t("bulkMessages.fields.utm")}>
          <span className="font-mono text-[13px]">{campaign.utm_campaign}</span>
        </Row>
        {campaign.scheduled_at ? (
          <Row label={t(`${C}.fields.scheduledAt`)}>{formatDateTime(campaign.scheduled_at)}</Row>
        ) : null}
      </dl>
    </SectionCard>
  )
}
