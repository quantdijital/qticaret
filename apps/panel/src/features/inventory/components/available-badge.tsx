import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import { formatCount } from "@/lib/format"

/** Sellable stock, marked when sold out or at or under the item's threshold. */
export function AvailableBadge({ available, threshold }: { available: number; threshold: number }) {
  const { t } = useTranslation()
  return available <= 0 ? (
    <StatusBadge tone="danger">{t("inventory.out")}</StatusBadge>
  ) : available <= threshold ? (
    <StatusBadge tone="warning">{t("inventory.lowCount", { count: available })}</StatusBadge>
  ) : (
    <span className="tabular-nums">{formatCount(available)}</span>
  )
}
