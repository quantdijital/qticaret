import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight, Inbox } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { recentOrdersQuery } from "@/features/dashboard/api/recent-orders"
import type { RecentOrder } from "@/features/dashboard/api/recent-orders"
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format"
import { CustomerCell } from "@/features/orders/components/customer-cell"
import { StageBadge } from "@/features/orders/components/stage-badge"

function OrdersTable({ orders }: { orders: RecentOrder[] }) {
  const { t } = useTranslation()
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
        <Inbox className="size-6" aria-hidden="true" />
        {t("dashboard.recent.empty")}
      </div>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">{t("dashboard.recent.order")}</TableHead>
          <TableHead>{t("dashboard.recent.customer")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("dashboard.recent.date")}</TableHead>
          <TableHead className="hidden lg:table-cell">{t("dashboard.recent.items")}</TableHead>
          <TableHead>{t("dashboard.recent.status")}</TableHead>
          <TableHead className="pr-5 text-right">{t("dashboard.recent.total")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id} className="h-[var(--row-height)]">
            <TableCell className="tabular pl-5 font-medium">
              <Link to="/orders/$id" params={{ id: order.id }} className="hover:underline">
                #{order.display_id}
              </Link>
            </TableCell>
            <TableCell>
              <CustomerCell customer={order.customer} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              <time dateTime={order.created_at} title={formatDateTime(order.created_at)}>
                {formatRelative(order.created_at)}
              </time>
            </TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">
              {t("dashboard.recent.itemsCount", { count: order.items })}
            </TableCell>
            <TableCell>
              <StageBadge stage={order.stage} />
            </TableCell>
            <TableCell className="tabular pr-5 text-right font-medium">
              {formatMoney(order.total, order.currency_code)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** The newest orders with who and where, their stage and total. */
export function RecentOrdersCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(recentOrdersQuery())
  return (
    <SectionCard
      title={t("dashboard.recent.title")}
      flush
      className={className}
      action={
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link to="/orders">
            {t("dashboard.recent.viewAll")}
            <ArrowRight />
          </Link>
        </Button>
      }
    >
      <AsyncBody
        query={query}
        skeleton={
          <div className="flex flex-col gap-2 px-5 pb-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        }
      >
        {(data) => <OrdersTable orders={data.orders} />}
      </AsyncBody>
    </SectionCard>
  )
}
