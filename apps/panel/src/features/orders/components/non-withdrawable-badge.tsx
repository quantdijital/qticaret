import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"

/**
 * Outside the right of withdrawal (MSY md. 15/1-ç): made to the buyer's
 * wish, or marked so on the product (F13.6, adr/0052 §8). Such a line comes
 * back only faulty or wrong, never exchanged.
 */
export function NonWithdrawableBadge() {
  const { t } = useTranslation()
  return <StatusBadge tone="warning">{t("orders.nonWithdrawable")}</StatusBadge>
}
