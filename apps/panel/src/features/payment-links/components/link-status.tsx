import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import type { LinkStatus } from "@/features/payment-links/api/types"

const TONE: Record<LinkStatus, StatusTone> = {
  open: "info",
  draft: "warning",
  paid: "success",
  expired: "neutral",
  canceled: "neutral",
}

/** A link's state in words with its colour; `draft` reads as "prices changed". */
export function LinkStatusBadge({ status }: { status: LinkStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONE[status]}>{t(`paymentLinks.status.${status}`)}</StatusBadge>
}
