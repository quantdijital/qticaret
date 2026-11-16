import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useAlertText } from "@/features/notifications/alert-text"
import type { AdminNotification } from "@/features/notifications/api"
import { formatRelative } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * One alert, in the bell and on its page: its icon, words and time, bold
 * while unread. Its link opens the record and marks it read (`onOpen`);
 * one with nowhere to go is read by its own button on the page.
 */
export function AlertItem({
  notification,
  onOpen,
  leading,
  trailing,
}: {
  notification: AdminNotification
  /** Called as the link is followed: the alert is read, the bell closes. */
  onOpen: (notification: AdminNotification) => void
  /** Before the icon: the page's checkbox. */
  leading?: ReactNode
  /** After the words: the page's "mark read". */
  trailing?: ReactNode
}) {
  const { t } = useTranslation()
  const { title, description, Icon, tone, link } = useAlertText(notification.data ?? {})
  const unread = !notification.read
  const body = (
    <span className="flex min-w-0 flex-1 gap-3">
      <span
        className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-[13px]", unread && "font-semibold")}>
          {unread ? <span className="sr-only">{t("notifications.unreadMark")}</span> : null}
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{description}</span>
        <span className="text-[11px] text-muted-foreground">
          {formatRelative(notification.created_at)}
        </span>
      </span>
      {unread ? (
        <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
      ) : null}
    </span>
  )
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/60">
      {leading}
      {link ? (
        <Link
          to={link.to}
          search={link.search}
          params={link.params}
          className="flex min-w-0 flex-1 outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => {
            onOpen(notification)
          }}
        >
          {body}
        </Link>
      ) : (
        body
      )}
      {trailing}
    </li>
  )
}
