import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ChevronRight, CircleCheck, Clock, FilePen, PackageMinus, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import { tasksQuery } from "@/features/dashboard/api/tasks"
import type { DashboardTasks } from "@/features/dashboard/api/tasks"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TaskRow {
  key: "toShip" | "awaitingPayment" | "lowStock" | "drafts"
  icon: LucideIcon
  count: number
  to: string
  search?: { status: "draft" } | { view: "low" }
  /** A count here needs the shop's attention (amber) rather than routine work. */
  urgent: boolean
}

function rows(tasks: DashboardTasks): TaskRow[] {
  return [
    { key: "toShip", icon: Truck, count: tasks.to_ship, to: "/orders", urgent: false },
    {
      key: "awaitingPayment",
      icon: Clock,
      count: tasks.awaiting_payment,
      to: "/orders",
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
  ]
}

function TaskList({ tasks }: { tasks: DashboardTasks }) {
  const { t } = useTranslation()
  const list = rows(tasks)
  if (list.every((row) => row.count === 0)) {
    return (
      <p className="flex items-center gap-2 px-5 pb-5 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-success-text" aria-hidden="true" />
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
