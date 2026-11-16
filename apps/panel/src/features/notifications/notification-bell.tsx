import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Bell } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@qticaret/admin-ui/ui/popover"
import { AlertItem } from "@/features/notifications/alert-item"
import { bellQuery, useMarkRead } from "@/features/notifications/api"
import type { AdminNotification } from "@/features/notifications/api"
import { errorText } from "@/lib/errors"

/**
 * The bell (adr/0020): the shop's newest alerts; the ones this person has
 * not read are counted on it (the server keeps what each one read).
 * Following an alert reads it; "Tümünü gör" opens the page with the rest.
 */
export function NotificationBell() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const list = useQuery(bellQuery())
  const mark = useMarkRead()
  const notifications = list.data?.notifications ?? []
  const unread = list.data?.unread ?? 0
  const opened = (notification: AdminNotification) => {
    setOpen(false)
    if (!notification.read) {
      mark.mutate({ ids: [notification.id] })
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label={
            unread > 0 ? t("notifications.openUnread", { count: unread }) : t("notifications.open")
          }
        >
          <Bell />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex h-11 items-center justify-between gap-2 border-b px-3">
          <span className="text-sm font-semibold">{t("notifications.title")}</span>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={mark.isPending}
              onClick={() => {
                mark.mutate(
                  { all: true },
                  { onError: (failure) => toast.error(errorText(t, failure)) }
                )
              }}
            >
              {t("notifications.markAllRead")}
            </Button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            {t("notifications.empty")}
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {notifications.map((notification) => (
              <AlertItem key={notification.id} notification={notification} onOpen={opened} />
            ))}
          </ul>
        )}
        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link
              to="/notifications"
              onClick={() => {
                setOpen(false)
              }}
            >
              {t("notifications.seeAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
