import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { Lifecycle } from "@/features/dashboard/api/overview"

// Needs the shop (amber), moving (blue), done (green), stopped (grey)
const TONE: Record<Lifecycle, StatusTone> = {
  awaiting_payment: "warning",
  to_ship: "warning",
  shipped: "info",
  // A dated order paid, its service day ahead (adr/0076 §8)
  planned: "info",
  delivered: "success",
  canceled: "neutral",
}

/** An order's stage in words (docs/06 sözlük) with its tone. */
export function StageBadge({ stage }: { stage: Lifecycle }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONE[stage]}>{t(`stage.${stage}`)}</StatusBadge>
}
