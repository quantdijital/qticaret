import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { BoardOrder } from "@/features/orders/api/orders"

/**
 * An order with lines made to the buyer's wish (adr/0052 §9): an engraving
 * or a pick to prepare before packing; its texts are on the order page and
 * the packing slip. Says it is made to order when a line is outside withdrawal.
 */
export function AddonBadge({ addons }: { addons: BoardOrder["addons"] | undefined }) {
  const { t } = useTranslation()
  if (!addons || addons.lines === 0) {
    return null
  }
  return (
    <StatusBadge tone="info">
      {t(addons.non_withdrawable ? "orders.addons.personal" : "orders.addons.badge", {
        count: addons.lines,
      })}
    </StatusBadge>
  )
}
