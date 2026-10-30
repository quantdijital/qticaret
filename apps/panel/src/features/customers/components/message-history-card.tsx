import { useQuery } from "@tanstack/react-query"
import { Mail, MessageSquare, MessagesSquare } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { messageHistoryQuery } from "@/features/customers/api/messages"
import type { MessageRow, MessageState } from "@/features/customers/api/messages"
import { formatDateTime } from "@/lib/format"

const M = "customers.messages"

const TONE: Record<MessageState, StatusTone> = {
  sent: "success",
  pending: "info",
  failed: "danger",
  skipped: "warning",
}

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
    <li className="flex items-start gap-3 border-t px-5 py-3 text-sm">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-label={t(`${M}.channel.${row.channel}`)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          {t(`settings.notifications.templates.names.${row.template}`, {
            defaultValue: row.template,
          })}
          <StatusBadge tone={TONE[row.state]}>{t(`${M}.state.${row.state}`)}</StatusBadge>
        </span>
        <span className="text-xs text-muted-foreground">
          {[formatDateTime(row.at), row.to].filter(Boolean).join(" · ")}
        </span>
        {why ? <span className="text-xs text-warning-text">{why}</span> : null}
      </div>
    </li>
  )
}

/**
 * What a customer was sent (F12.8), newest first: each e-mail and SMS with
 * whether it went, and for one that did not, why. For an order, its own,
 * its parcels' and its returns' messages; for a customer, all of them.
 */
export function MessageHistoryCard(props: { orderId: string } | { customerId: string }) {
  const { t } = useTranslation()
  const query = useQuery(messageHistoryQuery(props))
  return (
    <SectionCard
      title={t(`${M}.title`)}
      description={t("orderId" in props ? `${M}.orderText` : `${M}.customerText`)}
      flush
    >
      <AsyncBody query={query} skeleton={<Skeleton className="mx-5 mb-5 h-24" />}>
        {(data) =>
          data.messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 pt-2 pb-8 text-center">
              <MessagesSquare className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t(`${M}.empty`)}</p>
            </div>
          ) : (
            <>
              <ul className="flex flex-col">
                {data.messages.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </ul>
              {data.limited ? (
                <p className="border-t px-5 py-3 text-xs text-muted-foreground">
                  {t(`${M}.limited`)}
                </p>
              ) : null}
            </>
          )
        }
      </AsyncBody>
    </SectionCard>
  )
}
