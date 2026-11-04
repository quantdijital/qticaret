import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { ProviderAccount } from "@/features/settings/api/payments"
import { sectionQuery } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { AddressDataCard } from "@/features/settings/components/address-data-card"
import { DefaultParcelCard } from "@/features/settings/components/default-parcel-card"
import { ShippingOptionsCard } from "@/features/settings/components/shipping-options-card"
import { DeliveryCard, RatesCard } from "@/features/settings/components/shipping-rules-cards"
import { LabelSizeCard } from "@/features/settings/components/label-size-card"
import { ReturnsCard } from "@/features/settings/components/returns-card"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { LocationsPanel } from "@/features/settings/pages/locations-page"
import { SHIPPING_CARRIERS } from "@/features/settings/shipping-carriers"
import { errorText } from "@/lib/errors"

const S = "settings.shipping"

/** The carriers the shop ships with, each opening its own page where its account is connected. */
function CarriersCard({ accounts }: { accounts: readonly ProviderAccount[] }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t(`${S}.carriersTitle`)} description={t(`${S}.carriersDescription`)} flush>
      <ul>
        {SHIPPING_CARRIERS.map((carrier) => {
          const account = accounts.find(({ provider }) => provider === carrier.id)
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
  )
}

/**
 * Settings > Shipping and delivery (F7, adr/0031; the owner, 2026-10-31:
 * one page for delivery, in tabs): the carriers and the size their labels
 * print at; the options shoppers choose from, the delivery days and price
 * table (F7.8) and the default parcel of a product without measures
 * (adr/0054); the return rules (F13.4); the warehouses stock ships from;
 * the address data (il, ilçe, mahalle, köy) delivery addresses are chosen
 * from (adr/0008 Ek 2026-11-04).
 */
export function ShippingPage() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  const rules = useQuery(sectionQuery<ShippingSettings>("shipping"))
  const ruleCards = (render: (saved: ShippingSettings) => ReactNode) =>
    rules.data ? (
      render(rules.data.values)
    ) : rules.isError ? (
      <ErrorState text={errorText(t, rules.error)} onRetry={() => void rules.refetch()} />
    ) : (
      <LoadingRows rows={2} />
    )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${S}.title`)} description={t(`${S}.subtitle`)} />
      <SettingsTabs
        label={t(`${S}.title`)}
        tabs={[
          {
            key: "carriers",
            label: t(`${S}.tabs.carriers`),
            content: (
              <>
                {query.isError ? (
                  <ErrorState
                    text={errorText(t, query.error)}
                    onRetry={() => void query.refetch()}
                  />
                ) : !query.data ? (
                  <LoadingRows rows={2} />
                ) : (
                  <CarriersCard accounts={query.data.accounts} />
                )}
                {ruleCards((saved) => (
                  <LabelSizeCard key={`labels-${JSON.stringify(saved)}`} saved={saved} />
                ))}
              </>
            ),
          },
          {
            key: "options",
            label: t(`${S}.tabs.options`),
            content: (
              <>
                <ShippingOptionsCard />
                {ruleCards((saved) => (
                  <>
                    <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
                      <DeliveryCard key={JSON.stringify(saved)} saved={saved} />
                      <RatesCard key={`rates-${JSON.stringify(saved)}`} saved={saved} />
                    </div>
                    <DefaultParcelCard key={`parcel-${JSON.stringify(saved)}`} saved={saved} />
                  </>
                ))}
              </>
            ),
          },
          { key: "returns", label: t(`${S}.tabs.returns`), content: <ReturnsCard /> },
          { key: "locations", label: t(`${S}.tabs.locations`), content: <LocationsPanel /> },
          { key: "addresses", label: t(`${S}.tabs.addresses`), content: <AddressDataCard /> },
        ]}
      />
    </div>
  )
}
