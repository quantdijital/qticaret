import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { birfaturaStatusQuery } from "@/features/settings/api/einvoice"
import type { InvoicingSettings } from "@/features/settings/api/einvoice"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { ProviderAccount } from "@/features/settings/api/payments"
import { sectionQuery } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { ShippingAdvanced } from "@/features/settings/components/shipping-advanced"
import { ShippingFeeSection } from "@/features/settings/components/shipping-fee-section"
import { BookingFlowCard } from "@/features/settings/components/booking-flow-card"
import { ReturnsCard } from "@/features/settings/components/returns-card"
import { ReturnCodeCard } from "@/features/settings/components/return-code-card"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { ShippingManagerCard } from "@/features/settings/components/shipping-manager-card"
import { LocationsPanel } from "@/features/settings/pages/locations-page"
import { SHIPPING_CARRIERS } from "@/features/settings/shipping-carriers"
import { useCarrierShown } from "@/features/settings/api/carriers"
import { errorText } from "@/lib/errors"

const S = "settings.shipping"

/**
 * The carriers the shop ships with, each opening its own page where its
 * account is connected and the name its invoices carry is entered; the
 * shop's own parcels carry its own (Settings > Store > legal identity).
 */
function CarriersCard({
  accounts,
  unavailable,
}: {
  accounts: readonly ProviderAccount[]
  /** Carriers this server cannot connect: the platform's app with them is not set. */
  unavailable: readonly string[]
}) {
  const { t } = useTranslation()
  const shown = useCarrierShown()
  return (
    <SectionCard title={t(`${S}.carriersTitle`)} description={t(`${S}.carriersDescription`)} flush>
      <ul>
        {SHIPPING_CARRIERS.filter(({ id }) => shown(id)).map((carrier) => {
          const account = accounts.find(({ provider }) => provider === carrier.id)
          const name = t(`${S}.carriers.${carrier.id}.name`)
          const nameId = `shipping-carrier-${carrier.id}`
          const stored = account !== undefined && account.state !== "not_configured"
          const closed = unavailable.includes(carrier.id) && !stored
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
                {closed ? (
                  <span className="text-[13px] text-warning-text">
                    {t(`${S}.carrierUnavailable`)}
                  </span>
                ) : null}
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
 * "Kargoyu nereden yönetiyorsun?" (adr/0072 Ek 2026-11-26), and the
 * carriers while the shop ships with its own contracts. BirFatura counts
 * as connected once it is the invoicing program with its password made.
 */
function CarriersTab({ saved }: { saved: ShippingSettings | undefined }) {
  const { t } = useTranslation()
  const accounts = useQuery(providerAccountsQuery())
  const invoicing = useQuery(sectionQuery<InvoicingSettings>("invoicing"))
  const onBirfatura = invoicing.data?.values.provider === "birfatura"
  const birfatura = useQuery({ ...birfaturaStatusQuery(), enabled: onBirfatura })
  const token = birfatura.data?.token
  const connected = onBirfatura && Boolean(token) && token?.state !== "unreadable"
  const manager = saved?.manager ?? "own"
  const failed = accounts.isError ? accounts : invoicing.isError ? invoicing : null
  if (failed) {
    return <ErrorState text={errorText(t, failed.error)} onRetry={() => void failed.refetch()} />
  }
  if (!accounts.data || !saved || !invoicing.data) {
    return <LoadingRows rows={2} />
  }
  return (
    <div className="flex flex-col gap-6">
      <ShippingManagerCard saved={manager} connected={connected} />
      {/* BirFatura's carrier is not ours: its return code is named here (adr/0031 Ek 2026-11-26) */}
      {manager === "own" ? (
        <CarriersCard
          accounts={accounts.data.accounts}
          unavailable={accounts.data.unavailable ?? []}
        />
      ) : (
        <ReturnCodeCard target="other" />
      )}
    </div>
  )
}

/**
 * Settings > Shipping and delivery (F7, adr/0031; the owner, 2026-10-31:
 * one page for delivery, in tabs; 2026-11-26: as simple as WooCommerce's,
 * the fee one question). The carriers, each on its own page with the name
 * its invoices carry; "Kargo ücreti" (free, free above a total, flat, the
 * carrier's price) and the extra options, then "Gelişmiş" folded: delivery
 * days, the price table (F7.8), the default parcel (adr/0054), the label
 * size, the shipping classes (adr/0087); the
 * return rules (F13.4); the warehouses stock ships from. The address data
 * is the platform's (adr/0008 Ek 2026-11-04): an old `?part=addresses`
 * link opens the first tab.
 */
export function ShippingPage() {
  const { t } = useTranslation()
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
            content: <CarriersTab saved={saved} />,
          },
          {
            key: "options",
            label: t(`${S}.tabs.options`),
            content: (
              <>
                {saved ? (
                  <>
                    <ShippingFeeSection saved={saved} />
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
