import { Link } from "@tanstack/react-router"
import { Link2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DropdownMenuItem } from "@qticaret/admin-ui/ui/dropdown-menu"
import { useLinkAccess } from "./use-link-access"

/**
 * On the orders list (adr/0051 §13): "Yeni sipariş", while the shop has
 * payment links on and the person may make one. The links' own list is
 * an item of the list's "…" menu (`PaymentLinksMenuItem`).
 */
export function PaymentLinkButtons() {
  const { t } = useTranslation()
  const gate = useLinkAccess()
  if (gate.access !== "ok") {
    return null
  }
  return (
    <Button asChild size="sm">
      <Link to="/payment-links/new">
        <Plus />
        {t("paymentLinks.new")}
      </Link>
    </Button>
  )
}

/** The payment links' list, in the orders list's "…" menu, on the same terms. */
export function PaymentLinksMenuItem() {
  const { t } = useTranslation()
  const gate = useLinkAccess()
  if (gate.access !== "ok") {
    return null
  }
  return (
    <DropdownMenuItem asChild>
      <Link to="/payment-links">
        <Link2 />
        {t("paymentLinks.title")}
      </Link>
    </DropdownMenuItem>
  )
}
