import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { AccountStatus } from "@/features/wholesale/api/types"

const TONES: Record<AccountStatus, StatusTone> = {
  pending: "warning",
  active: "success",
  inactive: "neutral",
}

/** Bekliyor (invited, not signed up yet), Etkin, Kapalı. */
export function AccountBadge({ status }: { status: AccountStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONES[status]}>{t(`wholesale.status.${status}`)}</StatusBadge>
}
