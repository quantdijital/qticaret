import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { MyMfaCard } from "@/features/settings/components/my-mfa-card"
import { TeamMfaCard } from "@/features/settings/components/team-mfa-card"

/** Settings > Security (F12.6, adr/0040): one's own 2FA, and whether the team must use it. */
export function SecurityPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.security.title")}
        description={t("settings.security.description")}
      />
      <MyMfaCard />
      <TeamMfaCard />
    </div>
  )
}
