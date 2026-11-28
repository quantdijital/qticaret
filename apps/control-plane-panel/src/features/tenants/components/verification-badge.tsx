import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { Domain } from "@/features/tenants/api"

const TONES: Record<Domain["verification"], StatusTone> = {
  pending: "warning",
  verified: "info",
  active: "success",
  failed: "danger",
}

/** A domain's DNS check (F16.7): pending, verified (proved), active (also pointing here), failed. */
export function VerificationBadge({ domain }: { domain: Domain }) {
  const { t } = useTranslation()
  return (
    <StatusBadge tone={TONES[domain.verification]}>
      {t(`domains.states.${domain.verification}`)}
    </StatusBadge>
  )
}
