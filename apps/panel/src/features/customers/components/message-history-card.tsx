import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Mail, MessageSquare } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { EmptyRow } from "@/components/patterns/empty-row"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { messageHistoryQuery } from "@/features/customers/api/messages"
import type { MessageRow, MessageState } from "@/features/customers/api/messages"
import { formatDateTime } from "@/lib/format"

const M = "customers.messages"

/** The newest few show; the rest open on request (the owner, 2026-11-04: it took the page). */
export const MESSAGE_PREVIEW = 3

const TONE: Record<MessageState, StatusTone> = {
  sent: "success",
  pending: "info",
  failed: "danger",
  skipped: "warning",
}

/** One message on the timeline: what, whether it went, when and to whom on one line. */
function Row({ row }: { row: MessageRow }) {
  const { t } = useTranslation()
  const Icon = row.channel === "sms" ? MessageSquare : Mail
  const why =
    row.state === "skipped" && row.reason
      ? t(`${M}.reason.${row.reason}`)
      : row.state === "failed"
        ? t(`${M}.reason.provider`)
        : null
  return (
    <li className="flex items-start gap-3 px-5 py-2.5 text-sm">
      <span className="relative mt-px flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
        <Icon
          className="size-3.5 text-muted-foreground"
          aria-label={t(`${M}.channel.${row.channel}`)}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-col gap-0.5 md:flex-row md:items-center md:justify-between md:gap-4">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">
              {t(`settings.notifications.templates.names.${row.template}`, {
                defaultValue: row.template,
              })}
            </span>
            <StatusBadge tone={TONE[row.state]}>{t(`${M}.state.${row.state}`)}</StatusBadge>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {[formatDateTime(row.at), row.to].filter(Boolean).join(" · ")}
          </span>
        </div>
        {why ? <span className="text-xs text-warning-text">{why}</span> : null}
      </div>
    </li>
  )
}

function Timeline({ rows, limited }: { rows: MessageRow[]; limited: boolean }) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, MESSAGE_PREVIEW)
  const hidden = rows.length - MESSAGE_PREVIEW
  return (
    <>
      <div className="relative pb-2">
        {/* The thread joining the messages, behind their icons */}
        {shown.length > 1 ? (
          <span aria-hidden="true" className="absolute top-4 bottom-6 left-8 w-px bg-border" />
        ) : null}
        <ol className="flex flex-col">
          {shown.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ol>
      </div>
      {hidden > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={all}
            onClick={() => {
              setAll(!all)
            }}
          >
            {all ? <ChevronUp /> : <ChevronDown />}
            {all ? t(`${M}.showLess`) : t(`${M}.showAll`, { count: rows.length })}
          </Button>
          {all && limited ? (
            <p className="px-2 text-xs text-muted-foreground">{t(`${M}.limited`)}</p>
          ) : null}
        </div>
      ) : limited ? (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">{t(`${M}.limited`)}</p>
      ) : null}
    </>
  )
}

/**
 * What a customer was sent (F12.8), newest first: each e-mail and SMS with
 * whether it went, and for one that did not, why. For an order, its own,
 * its parcels' and its returns' messages; for a customer, all of them. A
 * compact timeline: the newest three, the rest on "Tümünü göster"; none
 * is one row, not a card.
 */
export function MessageHistoryCard(props: { orderId: string } | { customerId: string }) {
  const { t } = useTranslation()
  const query = useQuery(messageHistoryQuery(props))
  const description = t("orderId" in props ? `${M}.orderText` : `${M}.customerText`)
  if (query.data?.messages.length === 0) {
    return <EmptyRow text={t(`${M}.empty`)} />
  }
  return (
    <SectionCard title={t(`${M}.title`)} description={description} flush>
      <AsyncBody query={query} skeleton={<Skeleton className="mx-5 mb-5 h-24" />}>
        {(data) => <Timeline rows={data.messages} limited={data.limited} />}
      </AsyncBody>
    </SectionCard>
  )
}
