import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"

/**
 * A paid order placed though the shelf lacked units (adr/0026 Ek
 * 2026-11-06): the shop makes or buys them, or cancels and refunds. Shown
 * while there is still something to send.
 */
export function StockShortBadge({ units }: { units: number | undefined }) {
  const { t } = useTranslation()
  if (!units || units <= 0) {
    return null
  }
  return <StatusBadge tone="danger">{t("orders.stockShort.badge", { count: units })}</StatusBadge>
}
