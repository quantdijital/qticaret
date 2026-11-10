import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { Ga4Account, MetaAccount } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { Ga4Settings } from "@/features/settings/components/ga4-settings"
import { MetaSettings } from "@/features/settings/components/meta-settings"
import { accountKey } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/settings/marketing/$provider")
const C = "settings.marketing.conversions"

/** Settings > Marketing > Meta or GA4: its state by the title, its account below. */
export function ConversionProviderPage() {
  const { t } = useTranslation()
  const { provider } = route.useParams()
  const query = useQuery(providerAccountsQuery())
  const name = t(`${C}.providers.${provider}.name`)
  const account = query.data?.accounts.find((each) => each.provider === provider)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/settings/marketing", label: t("settings.marketing.title") }}
        title={name}
        description={t(`${C}.providers.${provider}.description`)}
        badge={query.data ? <AccountBadges account={account} name={name} /> : null}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={4} />
      ) : provider === "meta" ? (
        <MetaSettings
          key={accountKey(account)}
          account={account as MetaAccount | undefined}
          keyConfigured={query.data.key_configured}
        />
      ) : (
        <Ga4Settings
          key={accountKey(account)}
          account={account as Ga4Account | undefined}
          keyConfigured={query.data.key_configured}
        />
      )}
    </div>
  )
}
