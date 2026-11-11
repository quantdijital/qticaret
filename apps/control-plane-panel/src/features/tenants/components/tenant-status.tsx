import { useTranslation } from "react-i18next"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"

const TONES: Record<TenantStatus, StatusTone> = {
  provisioning: "info",
  active: "success",
  restricted: "warning",
  suspended: "danger",
  closing: "warning",
  closed: "neutral",
}

/** Where a shop stands in its lifecycle (adr/0061 §2), in its state's colour. */
export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONES[status]}>{t(`tenants.status.${status}`)}</StatusBadge>
}
