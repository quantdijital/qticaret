import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import { useFeatureState } from "@/features/settings/api/features"
import { sectionQuery } from "@/features/settings/api/sections"
import type { BankTransferSettings } from "@/features/settings/api/sections"
import type { ProviderAccount } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { InstallmentsCard } from "@/features/settings/components/installments-card"
import { PreferredProviderRow } from "@/features/settings/components/preferred-provider"
import { PAYMENT_METHODS } from "@/features/settings/payment-methods"
import type { PaymentGroup } from "@/features/settings/payment-methods"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import type { PaymentMethod } from "@/features/settings/payment-methods"
import { errorText } from "@/lib/errors"

const P = "settings.payments"

/**
 * On or off, for a way to pay with no provider account (adr/0029): bank
 * transfer by its settings, cash on delivery by its feature flag.
 */
function SettingsBadge({ id }: { id: PaymentMethod["id"] }) {
  const { t } = useTranslation()
  const bank = useQuery({
    ...sectionQuery<BankTransferSettings>("bank_transfer"),
    enabled: id === "bank_transfer",
  })
  const flag = useFeatureState("payments.cash_on_delivery")
  const enabled = id === "bank_transfer" ? bank.data?.values.enabled : flag
  if (enabled === undefined) {
    return null
  }
  return (
    <StatusBadge tone={enabled ? "success" : "neutral"}>
      {t(enabled ? `${P}.offered.on` : `${P}.offered.off`)}
    </StatusBadge>
  )
}

/** One way to pay: what it is, where it stands, and the door to its page. */
function MethodRow({
  method,
  account,
}: {
  method: PaymentMethod
  account: ProviderAccount | undefined
}) {
  const { t } = useTranslation()
  const name = t(`${P}.methods.${method.id}.name`)
  const nameId = `payment-method-${method.id}`
  const stored = account !== undefined && account.state !== "not_configured"
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-5 py-4">
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
        <span id={nameId} className="text-sm font-medium">
          {name}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {t(`${P}.methods.${method.id}.description`)}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {method.kind === "settings" ? (
          <>
            <SettingsBadge id={method.id} />
            <Button asChild variant="outline" size="sm">
              <Link
                to="/settings/payments/$provider"
                params={{ provider: method.id }}
                aria-describedby={nameId}
              >
                {t(`${P}.manage`)}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <AccountBadges account={account} name={name} />
            <Button asChild variant="outline" size="sm">
              <Link
                to="/settings/payments/$provider"
                params={{ provider: method.id }}
                aria-describedby={nameId}
              >
                {t(stored ? `${P}.manage` : `${P}.connect`)}
              </Link>
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

/**
 * Settings > Payment (F5, adr/0027): every way the shop takes payment,
 * card providers first. Each opens its own page, where the shop connects
 * its account; nothing waits on the platform team or a restart.
 */
export function PaymentsPage() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  const accounts = query.data?.accounts ?? []
  // Stored and usable, as the backend counts them (`connectedCardProviders`)
  const connectedCards = (["paytr", "iyzico"] as const).filter((id) =>
    accounts.some(
      ({ provider, state }) =>
        provider === id && (state === "connected" || state === "unverified" || state === "rejected")
    )
  )
  const methods = (group: PaymentGroup) =>
    query.isError ? (
      <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
    ) : !query.data ? (
      <LoadingRows rows={3} />
    ) : (
      <SectionCard
        title={t(`${P}.groups.${group}.title`)}
        description={t(`${P}.groups.${group}.description`)}
        flush
      >
        <ul className="flex flex-col">
          {PAYMENT_METHODS.filter((method) => method.group === group).map((method) => (
            <MethodRow
              key={method.id}
              method={method}
              account={accounts.find(({ provider }) => provider === method.id)}
            />
          ))}
          {group === "card" ? <PreferredProviderRow connected={connectedCards} /> : null}
        </ul>
      </SectionCard>
    )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${P}.title`)} description={t(`${P}.subtitle`)} />
      <SettingsTabs
        label={t(`${P}.title`)}
        tabs={[
          { key: "card", label: t(`${P}.groups.card.title`), content: methods("card") },
          // Installments follow the card providers they apply to
          {
            key: "installments",
            label: t(`${P}.tabs.installments`),
            content: <InstallmentsCard />,
          },
          { key: "other", label: t(`${P}.groups.other.title`), content: methods("other") },
        ]}
      />
    </div>
  )
}
