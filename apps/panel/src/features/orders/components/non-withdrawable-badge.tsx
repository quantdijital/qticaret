import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { WithdrawalExclusion } from "@/features/orders/api/returns"

/**
 * Outside the right of withdrawal (MSY md. 15/1-ç): marked so on the
 * product (F13.6), made to the buyer's wish (adr/0052 §8), or a gift card
 * line one of whose cards was spent (adr/0025 Ek 2026-11-03). The badge
 * says why in a word, its title in a sentence; with no reason (a request
 * read before reasons were kept) it says only that.
 */
export function NonWithdrawableBadge({
  reason = null,
}: {
  reason?: WithdrawalExclusion | null | undefined
}) {
  const { t } = useTranslation()
  const R = "orders.nonWithdrawableReasons"
  const short = reason && reason !== "product" ? t(`${R}.${reason}.short`) : null
  return (
    <span title={reason ? t(`${R}.${reason}.text`) : undefined} className="inline-flex">
      <StatusBadge tone="warning">
        {short ? `${t("orders.nonWithdrawable")} · ${short}` : t("orders.nonWithdrawable")}
      </StatusBadge>
    </span>
  )
}
