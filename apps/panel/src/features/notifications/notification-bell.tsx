import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Bell, Calculator, PackageMinus, Scale, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { markSeen, notificationsQuery, seenAt } from "@/features/notifications/api"
import type { AdminNotification } from "@/features/notifications/api"
import { isConnectable } from "@/features/settings/payment-methods"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const text = (value: unknown): string => (typeof value === "string" ? value : "")
const amount = (value: unknown): number => (typeof value === "number" ? value : 0)

/** What an alert says and where it leads, worded here from its data (adr/0020). */
function useAlertText(data: Record<string, unknown>) {
  const { t } = useTranslation()
  if (data["kind"] === "low_stock") {
    return {
      title: t("notifications.lowStock.title", { name: text(data["name"]) }),
      description: t("notifications.lowStock.description", {
        count: amount(data["available"]),
        threshold: amount(data["threshold"]),
      }),
      Icon: PackageMinus,
      tone: "bg-warning-soft text-warning-text",
      link: { to: "/inventory" as const, search: { view: "low" }, params: {} },
    }
  }
  if (data["kind"] === "provider_account") {
    const changes = Array.isArray(data["changes"]) ? data["changes"].map(text) : []
    const who = text(data["actor"])
    const provider = text(data["provider"])
    return {
      title: t("notifications.providerAccount.title", {
        provider: t(`settings.payments.methods.${provider}.name`, { defaultValue: provider }),
      }),
      description: [
        changes.map((change) => t(`notifications.providerAccount.changes.${change}`)).join(", "),
        who ? t("notifications.providerAccount.by", { who }) : "",
      ]
        .filter(Boolean)
        .join(" · "),
      Icon: ShieldAlert,
      tone: "bg-info-soft text-info-text",
      // Straight to the provider's page; one the panel does not know opens the list
      link: isConnectable(provider)
        ? { to: "/settings/payments/$provider" as const, search: {}, params: { provider } }
        : { to: "/settings/payments" as const, search: {}, params: {} },
    }
  }
  if (data["kind"] === "accounting_sync") {
    return {
      title: t("notifications.accountingSync.title"),
      description: t("notifications.accountingSync.description"),
      Icon: Calculator,
      tone: "bg-destructive-soft text-destructive-text",
      link: { to: "/settings/accounting" as const, search: {}, params: {} },
    }
  }
  if (data["kind"] === "statement_check") {
    const provider = text(data["provider"])
    const day = text(data["day"])
    return {
      title: t("notifications.statementCheck.title", {
        provider: t(`settings.payments.methods.${provider}.name`, { defaultValue: provider }),
        day: day.split("-").reverse().join("."),
      }),
      description: t("notifications.statementCheck.description", {
        count: amount(data["issues"]),
      }),
      Icon: Scale,
      tone: "bg-warning-soft text-warning-text",
      // The day itself on the finance report, where its differences are listed
      link: { to: "/reports/finance" as const, search: { from: day, to: day }, params: {} },
    }
  }
  return {
    title: text(data["title"]),
    description: text(data["description"]),
    Icon: Bell,
    tone: "bg-muted text-muted-foreground",
    link: null,
  }
}

function Entry({ notification, unread }: { notification: AdminNotification; unread: boolean }) {
  const { title, description, Icon, tone, link } = useAlertText(notification.data ?? {})
  const body = (
    <div className="flex gap-3 px-3 py-2.5">
      <span
        className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}
      >
        <Icon className="size-4" aria-hidden="true" />
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
      {link ? (
        <Link
          to={link.to}
          search={link.search}
          params={link.params}
          className="block hover:bg-muted/60"
        >
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
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-destructive-foreground">
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
