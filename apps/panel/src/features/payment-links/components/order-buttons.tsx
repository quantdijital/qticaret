import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useLinkAccess } from "./use-link-access"

/**
 * On the orders list (adr/0051 §13): its payment links and "Yeni sipariş",
 * while the shop has them on and the person may make one.
 */
export function PaymentLinkButtons() {
  const { t } = useTranslation()
  const gate = useLinkAccess()
  if (gate.access !== "ok") {
    return null
  }
  return (
    <>
      <Button asChild variant="outline" size="sm">
        <Link to="/payment-links">{t("paymentLinks.title")}</Link>
      </Button>
      <Button asChild size="sm">
        <Link to="/payment-links/new">
          <Plus />
          {t("paymentLinks.new")}
        </Link>
      </Button>
    </>
  )
}
