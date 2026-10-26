import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Bell, PackageMinus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { markSeen, notificationsQuery, seenAt } from "@/features/notifications/api"
import type { AdminNotification } from "@/features/notifications/api"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const text = (value: unknown): string => (typeof value === "string" ? value : "")
const amount = (value: unknown): number => (typeof value === "number" ? value : 0)

function Entry({ notification, unread }: { notification: AdminNotification; unread: boolean }) {
  const { t } = useTranslation()
  const data = notification.data ?? {}
  const isLowStock = data["kind"] === "low_stock"
  const title = isLowStock
    ? t("notifications.lowStock.title", { name: text(data["name"]) })
    : text(data["title"])
  const description = isLowStock
    ? t("notifications.lowStock.description", {
        count: amount(data["available"]),
        threshold: amount(data["threshold"]),
      })
    : text(data["description"])
  const body = (
    <div className="flex gap-3 px-3 py-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-text">
        <PackageMinus className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-[13px]", unread && "font-semibold")}>{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
        <span className="text-[11px] text-muted-foreground">
          {formatRelative(notification.created_at)}
        </span>
      </span>
    </div>
  )
  return (
    <li>
      {isLowStock ? (
        <Link to="/inventory" search={{ view: "low" }} className="block hover:bg-muted/60">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  )
}

/**
 * The bell (adr/0020): the shop's alerts, newest first; the ones that
 * came since the bell was last opened in this browser are counted on it.
 */
export function NotificationBell() {
  const { t } = useTranslation()
  const list = useQuery(notificationsQuery())
  const [seen, setSeen] = useState(seenAt)
  const notifications = list.data ?? []
  const unread = notifications.filter((each) => new Date(each.created_at).getTime() > seen).length
  return (
    <Popover
      onOpenChange={(open) => {
        // Seen up to the newest alert's own (server) time, whatever the browser's clock says;
        // the list opened still marks what was new, the badge clears on closing
        const newest = notifications[0]
        if (open && newest) {
          markSeen(Math.max(seen, new Date(newest.created_at).getTime()))
        } else if (!open) {
          setSeen(seenAt())
        }
      }}
    >
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
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2.5 text-sm font-semibold">{t("notifications.title")}</div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            {t("notifications.empty")}
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {notifications.map((notification) => (
              <Entry
                key={notification.id}
                notification={notification}
                unread={new Date(notification.created_at).getTime() > seen}
              />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
