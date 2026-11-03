import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import type { LinkStatus, PaymentLinkSummary } from "@/features/payment-links/api/types"
import { shownStatus } from "./link-state"

const TONE: Record<LinkStatus, StatusTone> = {
  open: "info",
  draft: "warning",
  paid: "success",
  expired: "neutral",
  canceled: "neutral",
}

/**
 * A link's state in words with its colour; `draft` reads as "prices
 * changed", and one past its end as expired (`shownStatus`).
 */
export function LinkStatusBadge({
  link,
}: {
  link: Pick<PaymentLinkSummary, "status" | "expires_at">
}) {
  const { t } = useTranslation()
  const status = shownStatus(link)
  return <StatusBadge tone={TONE[status]}>{t(`paymentLinks.status.${status}`)}</StatusBadge>
}
