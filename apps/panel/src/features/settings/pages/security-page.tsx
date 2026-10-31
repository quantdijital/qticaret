import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { useCan } from "@/features/auth/api/staff"
import { FraudBlocksCard } from "@/features/settings/components/fraud-blocks-card"
import { FraudRulesCard } from "@/features/settings/components/fraud-rules-card"
import { MyMfaCard } from "@/features/settings/components/my-mfa-card"
import { TeamMfaCard } from "@/features/settings/components/team-mfa-card"

/**
 * Settings > Security (F12.6, adr/0040; F15.6, adr/0044): one's own 2FA,
 * whether the team must use it, when an order is held for review, and who
 * the shop turns away (owner and admin).
 */
export function SecurityPage() {
  const { t } = useTranslation()
  const fraud = useCan("fraud")
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.security.title")}
        description={t("settings.security.description")}
      />
      <MyMfaCard />
      <TeamMfaCard />
      <FraudRulesCard />
      {fraud ? <FraudBlocksCard /> : null}
    </div>
  )
}
