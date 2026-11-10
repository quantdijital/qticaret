import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { MfaCard } from "@/features/account/components/mfa-card"
import { ProfileCard } from "@/features/account/components/profile-card"
import { SessionsCard } from "@/features/account/components/sessions-card"
import { useMe } from "@/features/auth/api"

/** "Hesabım": one's own name, 2FA and sessions; every member, whatever the role. */
export function AccountPage() {
  const { t } = useTranslation()
  const me = useMe()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("account.title")} description={t("account.text")} />
      {me ? (
        <PageGrid>
          <PageColumn span={6}>
            <ProfileCard me={me} />
            <MfaCard me={me} />
          </PageColumn>
          <PageColumn span={6}>
            <SessionsCard />
          </PageColumn>
        </PageGrid>
      ) : null}
    </div>
  )
}
