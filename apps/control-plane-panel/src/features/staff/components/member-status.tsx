import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StaffMember } from "@/features/staff/api"

/**
 * Where a member stands: deactivated; active but without 2FA (a new member
 * still to set it up, or one whose 2FA an owner reset); active.
 */
export function MemberStatus({ member }: { member: Pick<StaffMember, "active" | "mfa"> }) {
  const { t } = useTranslation()
  if (!member.active) {
    return <StatusBadge tone="neutral">{t("staff.status.inactive")}</StatusBadge>
  }
  if (!member.mfa) {
    return <StatusBadge tone="warning">{t("staff.status.setup")}</StatusBadge>
  }
  return <StatusBadge tone="success">{t("staff.status.active")}</StatusBadge>
}
