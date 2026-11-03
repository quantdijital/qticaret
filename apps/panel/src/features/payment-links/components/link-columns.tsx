import { Link } from "@tanstack/react-router"
import { BadgePercent } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Column } from "@/components/patterns/data-table"
import type { PaymentLinkSummary } from "@/features/payment-links/api/types"
import { formatKurus } from "@/features/payment-links/format"
import { formatDateTime } from "@/lib/format"
import { LinkStatusBadge } from "./link-status"
import { useCreatorName } from "./use-creator-name"

const P = "paymentLinks.columns"

/**
 * The list's columns (adr/0051 §13): number, the customer as the backend
 * masks them, the total with its discount, the state, who made it, when
 * it ends and when it was made.
 */
export function useLinkColumns(): Column<PaymentLinkSummary>[] {
  const { t } = useTranslation()
  const creator = useCreatorName()
  return [
    {
      key: "number",
      header: t(`${P}.number`),
      cell: (row) => (
        <Link
          to="/payment-links/$id"
          params={{ id: row.id }}
          className="font-medium tabular-nums hover:underline"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {row.number}
        </Link>
      ),
    },
    {
      key: "customer",
      header: t(`${P}.customer`),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{row.customer.name ?? "—"}</span>
          {row.customer.email ? (
            <span className="truncate text-xs text-muted-foreground">{row.customer.email}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "total",
      header: t(`${P}.total`),
      align: "right",
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums">{formatKurus(row.total, row.currency_code)}</span>
          {row.discount_total > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <BadgePercent className="size-3.5" aria-hidden="true" />
              {t("paymentLinks.discountMark", {
                amount: formatKurus(row.discount_total, row.currency_code),
              })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: t(`${P}.status`),
      cell: (row) => <LinkStatusBadge link={row} />,
    },
    {
      key: "createdBy",
      header: t(`${P}.createdBy`),
      className: "hidden md:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground">
          {creator(row.created_by, row.created_by_name)}
        </span>
      ),
    },
    {
      key: "expires",
      header: t(`${P}.expires`),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">{formatDateTime(row.expires_at)}</span>
      ),
    },
    {
      key: "created",
      header: t(`${P}.created`),
      className: "hidden xl:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">{formatDateTime(row.created_at)}</span>
      ),
    },
  ]
}
