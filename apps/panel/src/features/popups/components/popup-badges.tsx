import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { PopupState } from "@/features/popups/api/types"

const TONE: Record<PopupState, StatusTone> = {
  live: "success",
  scheduled: "info",
  off: "neutral",
  ended: "neutral",
  campaign_inactive: "warning",
}

/** Where a pop-up stands now (adr/0080 §5 `state`), in words with its colour. */
export function PopupStateBadge({ state }: { state: PopupState }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONE[state]}>{t(`popups.state.${state}`)}</StatusBadge>
}
