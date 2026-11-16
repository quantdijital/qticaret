import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import type { BoardOrder } from "@/features/orders/api/orders"
import { OrderBoardCard } from "@/features/orders/components/order-board-card"
import { OrderExportButton } from "@/features/orders/components/order-export"
import { cleanSearch, filtersOf } from "@/features/orders/search"
import { useWholesaleOpen } from "@/features/wholesale/api/access"
import { accountOptionsQuery } from "@/features/wholesale/api/accounts"
import { WholesaleGate } from "@/features/wholesale/components/wholesale-gate"
import { WholesaleNav } from "@/features/wholesale/components/wholesale-nav"
import { accountTitle } from "@/features/wholesale/format"
import type { WholesaleOrderSearch } from "@/features/wholesale/search"

const route = getRouteApi("/_auth/wholesale/orders")
const O = "wholesale.orders"
// Radix's Select takes no empty value: "every wholesaler" is this
const EVERY = "all"

/** The wholesaler who placed the order, linking to their page. */
function useWholesalerColumn(): Column<BoardOrder> {
  const { t } = useTranslation()
  return {
    key: "wholesaler",
    header: t(`${O}.wholesaler`),
    className: "hidden md:table-cell",
    cell: (order) =>
      order.wholesaler?.id ? (
        <Link
          to="/wholesale/$id"
          params={{ id: order.wholesaler.id }}
          className="font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {order.wholesaler.name ?? t(`${O}.unnamed`)}
        </Link>
      ) : order.wholesaler ? (
        <span>{order.wholesaler.name ?? t(`${O}.unnamed`)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }
}

/** The list narrowed to one wholesaler, or all of them. */
function WholesalerPicker({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (id: string | undefined) => void
}) {
  const { t } = useTranslation()
  const accounts = useQuery(accountOptionsQuery())
  return (
    <Select
      value={value ?? EVERY}
      onValueChange={(next) => {
        onChange(next === EVERY ? undefined : next)
      }}
    >
      <SelectTrigger aria-label={t(`${O}.pick`)} className="w-full sm:w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EVERY}>{t(`${O}.every`)}</SelectItem>
        {(accounts.data ?? []).map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {accountTitle(account)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function WholesaleOrders() {
  const search = route.useSearch()
  const navigate = useNavigate()
  const page = (search.page ?? 1) - 1
  const filters = {
    ...filtersOf(search),
    segment: "wholesale" as const,
    wholesaler: search.wholesaler,
  }
  const column = useWholesalerColumn()
  const setSearch = (next: WholesaleOrderSearch) => {
    const merged = { ...search, ...next }
    void navigate({
      to: "/wholesale/orders",
      search: { ...cleanSearch(merged), wholesaler: merged.wholesaler },
      replace: true,
    })
  }
  return (
    <OrderBoardCard
      filters={filters}
      page={page}
      search={search}
      onSearch={setSearch}
      onRefilter={(next) => {
        setSearch({ ...next, page: 1 })
      }}
      extraColumns={[column]}
      toolbar={
        <WholesalerPicker
          value={search.wholesaler}
          onChange={(wholesaler) => {
            setSearch({ wholesaler, page: 1 })
          }}
        />
      }
    />
  )
}

/**
 * Toptancılar > Siparişler (ADR-0068 Ek 2026-11-15 (2)): the orders
 * wholesalers placed, apart from the retail list, with the same columns,
 * filters, shipping and order page; the wholesaler beside each, and a
 * picker for one wholesaler's.
 */
export function WholesaleOrdersPage() {
  const { t } = useTranslation()
  const ready = useWholesaleOpen()
  const search = route.useSearch()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("wholesale.list.title")}
        description={t(`${O}.description`)}
        action={
          ready ? (
            <OrderExportButton
              filters={{
                ...filtersOf(search),
                segment: "wholesale",
                wholesaler: search.wholesaler,
              }}
            />
          ) : undefined
        }
      />
      <WholesaleNav />
      <WholesaleGate>
        <WholesaleOrders />
      </WholesaleGate>
    </div>
  )
}
