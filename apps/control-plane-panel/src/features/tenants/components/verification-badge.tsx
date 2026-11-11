import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { Domain } from "@/features/tenants/api"

const TONES: Record<Domain["verification"], StatusTone> = {
  pending: "warning",
  verified: "success",
  failed: "danger",
}

/** A domain's DNS check: pending until F16.7 verifies it. */
export function VerificationBadge({ domain }: { domain: Domain }) {
  const { t } = useTranslation()
  return (
    <StatusBadge tone={TONES[domain.verification]}>
      {t(`domains.states.${domain.verification}`)}
    </StatusBadge>
  )
}
