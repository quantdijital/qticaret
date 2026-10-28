import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { NetgsmAccount } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { NetgsmSettings } from "@/features/settings/components/netgsm-settings"
import { SuppressionsCard } from "@/features/settings/components/suppressions-card"
import { accountKey } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

const N = "settings.notifications"

/**
 * Settings > Notifications (F9, adr/0036): how the shop's messages reach
 * its customers. E-mail is the platform's; SMS goes on the shop's own
 * Netgsm account, entered here.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  const account = query.data?.accounts.find((each) => each.provider === "netgsm")
  const name = t(`${N}.sms.name`)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${N}.title`)}
        description={t(`${N}.description`)}
        badge={query.data ? <AccountBadges account={account} name={name} /> : null}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={4} />
      ) : (
        <NetgsmSettings
          key={accountKey(account)}
          account={account as NetgsmAccount | undefined}
          keyConfigured={query.data.key_configured}
        />
      )}
      <SuppressionsCard />
    </div>
  )
}
