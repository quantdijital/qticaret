import { Link } from "@tanstack/react-router"
import { FileText, Gavel, ShieldAlert, TicketCheck, Undo2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HeaderMenu } from "@qticaret/admin-ui/patterns/header-menu"
import { DropdownMenuItem, DropdownMenuSeparator } from "@qticaret/admin-ui/ui/dropdown-menu"
import type { OrderFilters } from "@/features/orders/api/orders"
import { OrderExportButton } from "@/features/orders/components/order-export"
import { useVouchersOn } from "@/features/orders/components/use-vouchers-on"
import { VoucherCheckDialog } from "@/features/orders/components/voucher-check"
import {
  PaymentLinkButtons,
  PaymentLinksMenuItem,
} from "@/features/payment-links/components/order-buttons"

// The queues of orders waiting on someone, each a page of its own (docs/06 §4)
const QUEUES = [
  { to: "/orders/review", label: "orders.fraud.queue", icon: ShieldAlert },
  { to: "/orders/returns", label: "orders.returns.queue", icon: Undo2 },
  { to: "/orders/chargebacks", label: "orders.chargeback.queue", icon: Gavel },
  { to: "/orders/invoices", label: "orders.invoice.queue", icon: FileText },
] as const

/**
 * The orders list's header (the owner 2026-11-26: eight buttons side by
 * side were cramped; the product page's pattern, PR #434): the list as a
 * file (the owner's alone) and "Yeni sipariş" (adr/0051, while payment
 * links are on) stay as buttons; the queues, the payment links' list and
 * the voucher check (adr/0076 Ek D7b) are in the "…" menu.
 */
export function OrdersHeaderActions({ filters }: { filters: OrderFilters }) {
  const { t } = useTranslation()
  const vouchers = useVouchersOn()
  const [checking, setChecking] = useState(false)
  return (
    <>
      <OrderExportButton filters={filters} />
      <PaymentLinkButtons />
      <HeaderMenu size="sm">
        {QUEUES.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} asChild>
            <Link to={to}>
              <Icon />
              {t(label)}
            </Link>
          </DropdownMenuItem>
        ))}
        <PaymentLinksMenuItem />
        {vouchers ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setChecking(true)
              }}
            >
              <TicketCheck />
              {t("orders.vouchers.title")}
            </DropdownMenuItem>
          </>
        ) : null}
      </HeaderMenu>
      <VoucherCheckDialog open={checking} onOpenChange={setChecking} />
    </>
  )
}
