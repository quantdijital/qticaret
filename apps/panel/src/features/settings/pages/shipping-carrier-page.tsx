import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { GeliverAccount } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { GeliverSettings } from "@/features/settings/components/geliver-settings"
import { accountKey } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/settings/shipping/$carrier")
const S = "settings.shipping"

/** Settings > Shipping > one carrier: its state by the title, its settings below. */
export function ShippingCarrierPage() {
  const { t } = useTranslation()
  const { carrier } = route.useParams()
  const query = useQuery(providerAccountsQuery())
  const name = t(`${S}.carriers.${carrier}.name`)
  const account = query.data?.accounts.find((each) => each.provider === carrier)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/settings/shipping", label: t(`${S}.title`) }}
        title={name}
        description={t(`${S}.carriers.${carrier}.description`)}
        badge={query.data ? <AccountBadges account={account} name={name} /> : null}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={4} />
      ) : (
        <GeliverSettings
          key={accountKey(account)}
          account={account as GeliverAccount | undefined}
          keyConfigured={query.data.key_configured}
        />
      )}
    </div>
  )
}
