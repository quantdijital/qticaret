import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  Calculator,
  ChevronRight,
  CircleCheck,
  Clock,
  FilePen,
  Landmark,
  PackageMinus,
  RotateCcw,
  SearchCheck,
  Truck,
  Webhook,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useCan } from "@/features/auth/api/staff"
import { tasksQuery } from "@/features/dashboard/api/tasks"
import type { DashboardTasks } from "@/features/dashboard/api/tasks"
import { pendingQuery } from "@/features/dashboard/api/pending"
import { pendingRows } from "@/features/dashboard/components/pending-rows"
import type { TaskRow } from "@/features/dashboard/components/pending-rows"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

/** What the person may act on: the accounting program and the hooks are the set-up's (adr/0040). */
interface Reach {
  settings: boolean
  keys: boolean
}

function rows(tasks: DashboardTasks, reach: Reach): TaskRow[] {
  return [
    {
      key: "toShip",
      icon: Truck,
      count: tasks.to_ship,
      to: "/orders",
      search: { stage: "to_ship" },
      urgent: false,
    },
    {
      key: "awaitingPayment",
      icon: Clock,
      count: tasks.awaiting_payment,
      to: "/orders",
      search: { stage: "awaiting_payment" },
      urgent: false,
    },
    {
      key: "lowStock",
      icon: PackageMinus,
      count: tasks.low_stock,
      to: "/inventory",
      search: { view: "low" },
      urgent: true,
    },
    {
      key: "drafts",
      icon: FilePen,
      count: tasks.draft_products,
      to: "/products",
      search: { status: "draft" },
      urgent: false,
    },
    // Only while there are any: money taken for no order, refunded on its own or by hand
    ...(tasks.orphan_payments.refunding + tasks.orphan_payments.by_hand > 0
      ? [
          {
            key: "orphanPayments" as const,
            icon: RotateCcw,
            count: tasks.orphan_payments.refunding + tasks.orphan_payments.by_hand,
            to: "/settings/payments",
            urgent: true,
          },
        ]
      : []),
    // F12.1: only where the shop uses them, for those who can set them right
    ...(tasks.accounting_stopped !== null && reach.settings
      ? [
          {
            key: "accountingStopped" as const,
            icon: Calculator,
            count: tasks.accounting_stopped,
            to: "/settings/einvoice",
            search: { part: "accounting" },
            urgent: true,
          },
        ]
      : []),
    ...(tasks.webhooks_disabled !== null && reach.keys
      ? [
          {
            key: "webhooksDisabled" as const,
            icon: Webhook,
            count: tasks.webhooks_disabled,
            to: "/settings/api",
            urgent: true,
          },
        ]
      : []),
    // F13.9: the law asks a web shop to show who it is; gone once complete
    ...(tasks.legal_identity_missing > 0 && reach.settings
      ? [
          {
            key: "legalIdentity" as const,
            icon: Landmark,
            count: tasks.legal_identity_missing,
            to: "/settings/store",
            search: { part: "legal" },
            urgent: true,
          },
        ]
      : []),
    // F12.10: gone once the shop has set up what it can
    ...(tasks.seo_setup_open > 0 && reach.settings
      ? [
          {
            key: "seoSetup" as const,
            icon: SearchCheck,
            count: tasks.seo_setup_open,
            to: "/settings/seo",
            search: { part: "overview" },
            urgent: false,
          },
        ]
      : []),
  ]
}

function TaskList({ tasks }: { tasks: DashboardTasks }) {
  const { t } = useTranslation()
  // The lists the menu badges, while anything waits in them; the card does not wait for them
  const { data: pending } = useQuery(pendingQuery())
  const list = [
    ...rows(tasks, { settings: useCan("settings"), keys: useCan("keys") }),
    ...pendingRows(pending),
  ]
  if (list.every((row) => row.count === 0)) {
    return (
      <p className="flex items-start gap-2 px-5 pb-5 text-sm text-muted-foreground">
        <CircleCheck className="h-lh w-4 shrink-0 text-success-text" aria-hidden="true" />
        {t("dashboard.tasks.allClear")}
      </p>
    )
  }
  return (
    <ul className="flex flex-col">
      {list.map((row) => (
        <li key={row.key} className="border-t first:border-t-0">
          <Link
            to={row.to}
            {...(row.search ? { search: row.search } : {})}
            className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md",
                row.count > 0 && row.urgent
                  ? "bg-warning-soft text-warning-text"
                  : "bg-muted text-muted-foreground",
                row.count > 0 && !row.urgent && "bg-accent text-accent-foreground"
              )}
            >
              <row.icon className="size-[18px]" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{t(`dashboard.tasks.${row.key}.label`)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t(`dashboard.tasks.${row.key}.hint`)}
              </span>
            </span>
            <span
              className={cn(
                "tabular text-lg font-semibold",
                row.count === 0 && "text-muted-foreground"
              )}
            >
              {formatCount(row.count)}
            </span>
            <ChevronRight
              className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** What waits for the shop, each row a door to the screen that handles it. */
export function TasksCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(tasksQuery())
  return (
    <SectionCard
      title={t("dashboard.tasks.title")}
      description={t("dashboard.tasks.description")}
      flush
      className={className}
    >
      <AsyncBody
        query={query}
        skeleton={
          <div className="flex flex-col gap-3 px-5 pb-5">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        }
      >
        {(tasks) => <TaskList tasks={tasks} />}
      </AsyncBody>
    </SectionCard>
  )
}
