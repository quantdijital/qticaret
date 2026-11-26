import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Avatar, AvatarFallback } from "@qticaret/admin-ui/ui/avatar"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import type { CustomerListItem, CustomerStatsAnswer } from "@/features/customers/api/customers"
import { figureText } from "@/features/customers/figures"
import type { CustomerFigure } from "@/features/customers/figures"
import { COLUMN_LABEL } from "@/features/customers/list-prefs"
import type { OptionalColumn } from "@/features/customers/list-prefs"
import { customerName, initialsOf } from "@/features/customers/names"

/** Where a numbers column hides first as the screen narrows. */
const SHOWN_FROM: Record<CustomerFigure, string> = {
  orders: "hidden sm:table-cell",
  spent: "",
  average: "hidden lg:table-cell",
  lastOrder: "hidden md:table-cell",
  city: "hidden lg:table-cell",
}

/** The page's numbers: `undefined` while they come, `null` when they could not be read. */
type PageStats = CustomerStatsAnswer | null | undefined

/** A numbers column: the page's totals, a placeholder while they come, "—" without them. */
function figureColumn(
  figure: CustomerFigure,
  header: string,
  stats: PageStats
): Column<CustomerListItem> {
  const byId = new Map(stats?.stats.map((row) => [row.customer_id, row]))
  return {
    key: figure,
    header,
    align: figure === "city" ? "left" : "right",
    className: SHOWN_FROM[figure],
    cell: (customer) => {
      const row = byId.get(customer.id)
      if (stats === null) {
        return <span className="text-muted-foreground">—</span>
      }
      if (!row || !stats) {
        return <Skeleton className={figure === "city" ? "h-4 w-16" : "ml-auto h-4 w-12"} />
      }
      return (
        <span
          className={figure === "spent" ? "tabular-nums" : "tabular-nums text-muted-foreground"}
        >
          {figureText(row, figure, stats.currency_code)}
        </span>
      )
    },
  }
}

/**
 * The customer list's columns: the customer and their kind always, the
 * optional ones (CU1: orders, spend, average basket, last order, city;
 * the sign-up day) as the person chose.
 */
export function useCustomerColumns(
  hidden: readonly OptionalColumn[],
  stats: PageStats
): Column<CustomerListItem>[] {
  const { t } = useTranslation()
  const shown = (column: OptionalColumn) => !hidden.includes(column)
  const figures = (["orders", "spent", "average", "lastOrder", "city"] as const)
    .filter(shown)
    .map((figure) => figureColumn(figure, t(COLUMN_LABEL[figure]), stats))
  return [
    {
      key: "customer",
      header: t("customers.columns.customer"),
      cell: (customer) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-muted text-xs font-medium">
              {initialsOf(customer)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <Link
              to="/customers/$id"
              params={{ id: customer.id }}
              className="truncate font-medium hover:underline"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              {customerName(customer) ?? t("orders.noName")}
            </Link>
            <span className="truncate text-xs text-muted-foreground">{customer.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "kind",
      header: t("customers.columns.kind"),
      cell: (customer) => (
        <StatusBadge tone={customer.has_account ? "info" : "neutral"}>
          {t(customer.has_account ? "customers.kind.registered" : "customers.kind.guest")}
        </StatusBadge>
      ),
    },
    ...figures,
    ...(shown("joined")
      ? [
          {
            key: "joined",
            header: t("customers.columns.joined"),
            align: "right" as const,
            className: "hidden sm:table-cell",
            cell: (customer: CustomerListItem) => (
              <span className="text-muted-foreground">
                {customer.created_at ? formatDate(customer.created_at) : "—"}
              </span>
            ),
          },
        ]
      : []),
  ]
}
