import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { customerMessagesQuery } from "@/features/settings/api/customer-messages"
import type { CustomerMessage } from "@/features/settings/api/customer-messages"
import { groupMessages, isReworded } from "@/features/settings/customer-messages"
import { errorText } from "@/lib/errors"
import { CustomerMessageDialog } from "./customer-message-dialog"

const C = "settings.notifications.customer"
const NAMES = "settings.notifications.templates.names"

function MessageRow({ message, onOpen }: { message: CustomerMessage; onOpen: () => void }) {
  const { t } = useTranslation()
  const channels = message.channels.map((channel) => t(`${C}.channels.${channel}`)).join(" · ")
  return (
    <li className="border-t">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring focus-visible:outline-solid"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{t(`${NAMES}.${message.name}`)}</span>
          <span className="text-xs text-muted-foreground">{channels}</span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isReworded(message) ? <StatusBadge tone="info">{t(`${C}.reworded`)}</StatusBadge> : null}
          {message.switch === "required" ? (
            <StatusBadge tone="neutral">{t(`${C}.required`)}</StatusBadge>
          ) : (
            <StatusBadge tone={message.enabled ? "success" : "warning"}>
              {t(message.enabled ? `${C}.on` : `${C}.off`)}
            </StatusBadge>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}

/**
 * Settings > Notifications > Müşteri mesajları (adr/0036 Ek 2026-11-10):
 * every message the shop's customers get, under its group; a row opens
 * the message's words and switch in one dialog.
 */
export function CustomerMessagesCard() {
  const { t } = useTranslation()
  const list = useQuery(customerMessagesQuery())
  const [open, setOpen] = useState<string | null>(null)
  const messages = list.data?.messages ?? []
  const chosen = messages.find((message) => message.name === open) ?? null
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)} flush>
      {list.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : !list.data ? (
        <div className="p-5">
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="flex flex-col">
          {groupMessages(messages).map(({ group, messages: rows }) => (
            <section key={group} aria-labelledby={`customer-messages-${group}`}>
              <h3
                id={`customer-messages-${group}`}
                className="border-t bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground"
              >
                {t(`${C}.groups.${group}`)}
              </h3>
              <ul>
                {rows.map((message) => (
                  <MessageRow
                    key={message.name}
                    message={message}
                    onOpen={() => {
                      setOpen(message.name)
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {chosen ? (
        <CustomerMessageDialog
          key={chosen.name}
          message={chosen}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
