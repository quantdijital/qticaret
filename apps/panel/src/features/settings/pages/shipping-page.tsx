import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { ProviderAccount } from "@/features/settings/api/payments"
import { sectionQuery } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { FreeShippingCard } from "@/features/settings/components/free-shipping-card"
import { ShippingAdvanced } from "@/features/settings/components/shipping-advanced"
import { ShippingClassesCard } from "@/features/settings/components/shipping-classes-card"
import { ShippingOptionsCard } from "@/features/settings/components/shipping-options-card"
import { BookingFlowCard } from "@/features/settings/components/booking-flow-card"
import { ReturnsCard } from "@/features/settings/components/returns-card"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { LocationsPanel } from "@/features/settings/pages/locations-page"
import { SHIPPING_CARRIERS } from "@/features/settings/shipping-carriers"
import { errorText } from "@/lib/errors"

const S = "settings.shipping"

/**
 * The carriers the shop ships with, each opening its own page where its
 * account is connected and the name its invoices carry is entered; the
 * shop's own parcels carry its own (Settings > Store > legal identity).
 */
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
      <p className="border-t px-5 py-3 text-[13px] text-muted-foreground">
        {t(`${S}.ownDeliveryInvoice`)}{" "}
        <Link
          to="/settings/store"
          search={{ part: "legal" }}
          className="font-medium text-foreground underline"
        >
          {t(`${S}.ownDeliveryLink`)}
        </Link>
      </p>
    </SectionCard>
  )
}

/**
 * Settings > Shipping and delivery (F7, adr/0031; the owner, 2026-10-31:
 * one page for delivery, in tabs; 2026-11-26: as simple as WooCommerce's).
 * The carriers, each on its own page with the name its invoices carry; the
 * options shoppers choose from, the free shipping total (F4.5) and the
 * shipping classes (adr/0087), then "Gelişmiş" folded: delivery days, the
 * price table (F7.8), the default parcel (adr/0054), the label size; the
 * return rules (F13.4); the warehouses stock ships from. The address data
 * is the platform's (adr/0008 Ek 2026-11-04): an old `?part=addresses`
 * link opens the first tab.
 */
export function ShippingPage() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  const rules = useQuery(sectionQuery<ShippingSettings>("shipping"))
  const saved = rules.data?.values
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${S}.title`)} description={t(`${S}.subtitle`)} />
      <SettingsTabs
        label={t(`${S}.title`)}
        tabs={[
          {
            key: "carriers",
            label: t(`${S}.tabs.carriers`),
            content: query.isError ? (
              <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
            ) : !query.data ? (
              <LoadingRows rows={2} />
            ) : (
              <CarriersCard accounts={query.data.accounts} />
            ),
          },
          {
            key: "options",
            label: t(`${S}.tabs.options`),
            content: (
              <>
                <ShippingOptionsCard />
                <FreeShippingCard />
                {saved ? (
                  <>
                    <ShippingClassesCard
                      key={`classes-${JSON.stringify(saved.shipping_classes ?? [])}`}
                      saved={saved}
                    />
                    <ShippingAdvanced saved={saved} />
                  </>
                ) : rules.isError ? (
                  <ErrorState
                    text={errorText(t, rules.error)}
                    onRetry={() => void rules.refetch()}
                  />
                ) : (
                  <LoadingRows rows={2} />
                )}
              </>
            ),
          },
          {
            key: "returns",
            label: t(`${S}.tabs.returns`),
            // adr/0076 Ek basit yol: the dated products' flows, while the shop sells them
            content: (
              <>
                <ReturnsCard />
                <BookingFlowCard />
              </>
            ),
          },
          { key: "locations", label: t(`${S}.tabs.locations`), content: <LocationsPanel /> },
        ]}
      />
    </div>
  )
}
