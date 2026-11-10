import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { NetgsmAccount } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { NetgsmSettings } from "@/features/settings/components/netgsm-settings"
import { accountKey } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/settings/sms/$provider")
const S = "settings.sms"

/** Settings > SMS > one service: its state by the title, its account below. */
export function SmsProviderPage() {
  const { t } = useTranslation()
  const { provider } = route.useParams()
  const query = useQuery(providerAccountsQuery())
  const name = t(`${S}.providers.${provider}.name`)
  const account = query.data?.accounts.find((each) => each.provider === provider)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/settings/notifications", search: { part: "sms" }, label: t(`${S}.title`) }}
        title={name}
        description={t(`${S}.providers.${provider}.description`)}
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
    </div>
  )
}
