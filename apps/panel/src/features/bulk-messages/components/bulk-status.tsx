import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import type { BulkStatus } from "@/features/bulk-messages/api/types"

const B = "bulkMessages"

const TONE: Record<BulkStatus, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  sending: "info",
  paused: "warning",
  sent: "success",
  cancelled: "neutral",
  failed: "danger",
}

/** A campaign's state in words with its colour. */
export function BulkStatusBadge({ status }: { status: BulkStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONE[status]}>{t(`${B}.status.${status}`)}</StatusBadge>
}
