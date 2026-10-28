import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import { sectionQuery } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { ShippingOptionsCard } from "@/features/settings/components/shipping-options-card"
import { DeliveryCard, RatesCard } from "@/features/settings/components/shipping-rules-cards"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { SHIPPING_CARRIERS } from "@/features/settings/shipping-carriers"
import { errorText } from "@/lib/errors"

const S = "settings.shipping"

/**
 * Settings > Shipping (F7, adr/0031): the carriers the shop ships with
 * (each opens its own page, where the shop connects its account), the
 * options shoppers choose from, and the shop's delivery days and price
 * table (F7.8).
 */
export function ShippingPage() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  const rules = useQuery(sectionQuery<ShippingSettings>("shipping"))
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${S}.title`)} description={t(`${S}.subtitle`)} />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={2} />
      ) : (
        <SectionCard
          title={t(`${S}.carriersTitle`)}
          description={t(`${S}.carriersDescription`)}
          flush
        >
          <ul>
            {SHIPPING_CARRIERS.map((carrier) => {
              const account = query.data.accounts.find(({ provider }) => provider === carrier.id)
              const name = t(`${S}.carriers.${carrier.id}.name`)
              const nameId = `shipping-carrier-${carrier.id}`
              const stored = account !== undefined && account.state !== "not_configured"
              return (
                <li
                  key={carrier.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-5 py-4"
                >
                  <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
                    <span id={nameId} className="text-sm font-medium">
                      {name}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {t(`${S}.carriers.${carrier.id}.description`)}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <AccountBadges account={account} name={name} />
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/settings/shipping/$carrier"
                        params={{ carrier: carrier.id }}
                        aria-describedby={nameId}
                      >
                        {t(stored ? `${S}.manage` : `${S}.connect`)}
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}
      <ShippingOptionsCard />
      {rules.data ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <DeliveryCard key={JSON.stringify(rules.data.values)} saved={rules.data.values} />
          <RatesCard key={`rates-${JSON.stringify(rules.data.values)}`} saved={rules.data.values} />
        </div>
      ) : rules.isError ? (
        <ErrorState text={errorText(t, rules.error)} onRetry={() => void rules.refetch()} />
      ) : (
        <LoadingRows rows={3} />
      )}
    </div>
  )
}
