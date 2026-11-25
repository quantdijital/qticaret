import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { OrderBoard } from "@/features/orders/api/orders"
import { OrderBoardCard } from "@/features/orders/components/order-board-card"
import { useCustomerFilter } from "@/features/orders/components/customer-filter"
import { OrderExportButton } from "@/features/orders/components/order-export"
import { VoucherCheckButton } from "@/features/orders/components/voucher-check"
import { cleanSearch, filtersOf } from "@/features/orders/search"
import type { OrderListSearch } from "@/features/orders/search"
import { PaymentLinkButtons } from "@/features/payment-links/components/order-buttons"
import { LimitNotice } from "@/features/settings/components/limit-notice"

const route = getRouteApi("/_auth/orders/")

/** A search here that found wholesale orders: they are under Toptancılar > Siparişler. */
function WholesaleMatches({ board, q }: { board: OrderBoard; q: string }) {
  const { t } = useTranslation()
  const count = board.wholesale_matches ?? 0
  if (count === 0) {
    return null
  }
  return (
    <p className="flex items-start gap-1.5 px-5 pb-3 text-[13px] text-muted-foreground">
      <Info className="h-lh w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {t("orders.wholesaleMatches", { count })}{" "}
        <Link
          to="/wholesale/orders"
          search={{ q }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("orders.wholesaleMatchesLink")}
        </Link>
      </span>
    </p>
  )
}

/**
 * Every retail order by stage (docs/06 §4): what needs packing first, then
 * the rest. A wholesaler's orders are on Toptancılar > Siparişler (ADR-0068
 * Ek 2026-11-15 (2)); a search here that finds one says so.
 */
export function OrdersPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const page = (search.page ?? 1) - 1
  const filters = filtersOf(search)
  const setSearch = (next: OrderListSearch) => {
    void navigate({ to: "/orders", search: cleanSearch({ ...search, ...next }), replace: true })
  }
  // One customer's orders: from the order's customer card or their page (`?customer=`)
  const customerFilter = useCustomerFilter(search.customer, (customer) => {
    setSearch({ customer, page: 1 })
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.orders")}
        description={t("orders.description")}
        action={
          <span className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/review">{t("orders.fraud.queue")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/returns">{t("orders.returns.queue")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/chargebacks">{t("orders.chargeback.queue")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders/invoices">{t("orders.invoice.queue")}</Link>
            </Button>
            {/* The list as it is filtered, as a file: the owner's alone */}
            {/* adr/0076 Ek D7b: a booking voucher's code checked at a departure */}
            <VoucherCheckButton />
            <OrderExportButton filters={filters} />
            {/* adr/0051: staff-made orders paid through a link, while the shop has them on */}
            <PaymentLinkButtons />
          </span>
        }
      />
      {/* adr/0061 Ek C14: the month's orders near or past the package's limit; never stopped */}
      <LimitNotice limit="orders_per_month" />
      <OrderBoardCard
        filters={filters}
        page={page}
        search={search}
        onSearch={setSearch}
        onRefilter={(next) => {
          setSearch({ ...next, page: 1 })
        }}
        extraFilters={customerFilter}
        notice={(board) => <WholesaleMatches board={board} q={filters.q} />}
      />
    </div>
  )
}
