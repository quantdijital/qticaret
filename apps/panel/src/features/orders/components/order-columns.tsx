import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import type { BoardOrder } from "@/features/orders/api/orders"
import { AddonBadge } from "@/features/orders/components/addon-badge"
import { CustomerCell } from "@/features/orders/components/customer-cell"
import { OrderShipping } from "@/features/orders/components/shipping-badge"
import { StageBadge } from "@/features/orders/components/stage-badge"
import { StockShortBadge } from "@/features/orders/components/stock-short-badge"
import { formatDateTime, formatMoney, formatRelative } from "@qticaret/admin-ui/lib/format"

/** The order list's columns (docs/06 §4): fewer on a phone, folded under the number and stage. */
export function useColumns(): Column<BoardOrder>[] {
  const { t } = useTranslation()
  return [
    {
      key: "order",
      header: t("orders.columns.order"),
      // On phones the customer's name sits under the number; its own column comes back from sm up
      cell: (order) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/orders/$id"
            params={{ id: order.id }}
            className="tabular font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            #{order.display_id}
          </Link>
          <span className="max-w-32 truncate text-xs text-muted-foreground sm:hidden">
            {order.customer.name ?? t("orders.noName")}
          </span>
        </div>
      ),
    },
    {
      key: "date",
      header: t("orders.columns.date"),
      className: "hidden md:table-cell",
      cell: (order) => (
        <time
          dateTime={order.created_at}
          title={formatDateTime(order.created_at)}
          className="text-muted-foreground"
        >
          {formatRelative(order.created_at)}
        </time>
      ),
    },
    {
      key: "customer",
      header: t("orders.columns.customer"),
      className: "hidden sm:table-cell",
      cell: (order) => <CustomerCell customer={order.customer} />,
    },
    {
      key: "stage",
      header: t("orders.columns.stage"),
      // On phones the total and the shipping sit under the stage; their columns come back wider
      cell: (order) => (
        <div className="flex flex-col items-start gap-1">
          <span className="flex flex-wrap items-center gap-1">
            <StageBadge stage={order.stage} />
            <AddonBadge addons={order.addons} />
            <StockShortBadge units={order.stock_short} />
          </span>
          <span className="tabular text-xs font-medium sm:hidden">
            {formatMoney(order.total, order.currency_code)}
          </span>
          <span className="max-w-36 md:hidden">
            <OrderShipping order={order} />
          </span>
        </div>
      ),
    },
    {
      key: "shipping",
      header: t("orders.columns.shipping"),
      className: "hidden md:table-cell",
      cell: (order) => <OrderShipping order={order} />,
    },
    {
      key: "items",
      header: t("orders.columns.items"),
      className: "hidden lg:table-cell",
      cell: (order) => (
        <span className="text-muted-foreground">
          {t("orders.itemsCount", { count: order.items })}
        </span>
      ),
    },
    {
      key: "total",
      header: t("orders.columns.total"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (order) => (
        <span className="tabular font-medium">{formatMoney(order.total, order.currency_code)}</span>
      ),
    },
  ]
}
