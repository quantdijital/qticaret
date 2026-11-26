import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { ArasAccount, GeliverAccount, YurticiAccount } from "@/features/settings/api/payments"
import { ArasSettings } from "@/features/settings/components/aras-settings"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { CarrierInvoiceCard } from "@/features/settings/components/carrier-invoice-card"
import { GeliverSettings } from "@/features/settings/components/geliver-settings"
import { YurticiSettings } from "@/features/settings/components/yurtici-settings"
import { accountKey } from "@/features/settings/payments"
import { isCarrier } from "@/features/settings/shipping-carriers"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/settings/shipping/$carrier")
const S = "settings.shipping"

/**
 * Settings > Shipping > one carrier: its state by the title, its settings
 * below, then the name and tax id its parcels' e-Arşiv invoices carry.
 */
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
      ) : carrier === "aras" ? (
        <ArasSettings
          key={accountKey(account)}
          account={account as ArasAccount | undefined}
          keyConfigured={query.data.key_configured}
        />
      ) : carrier === "yurtici" ? (
        <YurticiSettings
          key={accountKey(account)}
          account={account as YurticiAccount | undefined}
          keyConfigured={query.data.key_configured}
        />
      ) : (
        <GeliverSettings
          key={accountKey(account)}
          account={account as GeliverAccount | undefined}
          keyConfigured={query.data.key_configured}
        />
      )}
      {isCarrier(carrier) ? <CarrierInvoiceCard carrier={carrier} /> : null}
    </div>
  )
}
