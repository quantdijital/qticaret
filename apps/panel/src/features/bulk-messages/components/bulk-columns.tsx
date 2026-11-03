import { Link } from "@tanstack/react-router"
import { Mail, Smartphone } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Column } from "@/components/patterns/data-table"
import type { BulkMessageSummary } from "@/features/bulk-messages/api/types"
import { BulkStatusBadge } from "@/features/bulk-messages/components/bulk-status"
import { formatCount, formatDateTime } from "@/lib/format"

const B = "bulkMessages"

/** The moment that says most about where it stands, with what it is. */
function whenOf(row: BulkMessageSummary): { key: string; at: string } {
  if (row.finished_at) {
    return { key: "finished", at: row.finished_at }
  }
  if (row.started_at) {
    return { key: "started", at: row.started_at }
  }
  if (row.status === "scheduled" && row.scheduled_at) {
    return { key: "scheduled", at: row.scheduled_at }
  }
  return { key: "created", at: row.created_at }
}

/**
 * Nobody is counted before its first turn fixes the list (a scheduled one,
 * or one that waits for the SMS hours): its sources stand for its audience.
 */
const started = (row: BulkMessageSummary) => row.counts.audience > 0

/** The list's columns (adr/0050 §10): name, channel, state, audience, sent of target, when. */
export function useBulkColumns(): Column<BulkMessageSummary>[] {
  const { t } = useTranslation()
  return [
    {
      key: "name",
      header: t(`${B}.columns.name`),
      cell: (row) => (
        <Link
          to="/bulk-messages/$id"
          params={{ id: row.id }}
          className="font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "channel",
      header: t(`${B}.columns.channel`),
      cell: (row) => {
        const Icon = row.channel === "sms" ? Smartphone : Mail
        return (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5" aria-hidden="true" />
            {t(`${B}.channels.${row.channel}`)}
          </span>
        )
      },
    },
    {
      key: "status",
      header: t(`${B}.columns.status`),
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <BulkStatusBadge status={row.status} />
          {row.status === "paused" && row.paused_reason ? (
            <span className="text-xs text-muted-foreground">
              {t(`${B}.pauseShort.${row.paused_reason}`)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "audience",
      header: t(`${B}.columns.audience`),
      align: "right",
      className: "hidden md:table-cell",
      cell: (row) =>
        started(row) ? (
          <span className="tabular-nums">{formatCount(row.counts.audience)}</span>
        ) : (
          <span className="text-muted-foreground">
            {t(`${B}.sourceCount`, { count: row.audience.length })}
          </span>
        ),
    },
    {
      key: "sent",
      header: t(`${B}.columns.sent`),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (row) =>
        started(row) ? (
          <div className="flex flex-col items-end">
            <span className="tabular-nums">
              {formatCount(row.counts.sent)}
              <span className="text-muted-foreground"> / {formatCount(row.counts.targeted)}</span>
            </span>
            {row.counts.failed > 0 ? (
              <span className="text-xs text-destructive-text tabular-nums">
                {t(`${B}.failedCount`, { count: row.counts.failed })}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "when",
      header: t(`${B}.columns.when`),
      className: "hidden lg:table-cell",
      cell: (row) => {
        const when = whenOf(row)
        return (
          <div className="flex flex-col">
            <span className="tabular-nums">{formatDateTime(when.at)}</span>
            <span className="text-xs text-muted-foreground">{t(`${B}.when.${when.key}`)}</span>
          </div>
        )
      },
    },
  ]
}
