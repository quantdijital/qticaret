import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { IyzicoAccount, PaytrAccount, ProviderAccount } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { IyzicoSettings } from "@/features/settings/components/iyzico-settings"
import { PaytrSettings } from "@/features/settings/components/paytr-settings"
import { isAccountMethod } from "@/features/settings/payment-methods"
import type { AccountMethod } from "@/features/settings/payment-methods"
import { BankTransferPage } from "@/features/settings/pages/bank-transfer-page"
import { CashOnDeliveryPage } from "@/features/settings/pages/cash-on-delivery-page"
import { accountKey } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/settings/payments/$provider")

interface ProviderSettingsProps {
  account: ProviderAccount | undefined
  keyConfigured: boolean
}

/**
 * Each provider's own settings, keyed by the stored account so a save
 * starts the form afresh. The server describes each account with that
 * provider's settings (adr/0027). Installments join in V6 and V10.
 */
const PROVIDER_SETTINGS: Record<AccountMethod, (props: ProviderSettingsProps) => ReactNode> = {
  paytr: ({ account, keyConfigured }) => (
    <PaytrSettings
      key={accountKey(account)}
      account={account as PaytrAccount | undefined}
      keyConfigured={keyConfigured}
    />
  ),
  iyzico: ({ account, keyConfigured }) => (
    <IyzicoSettings
      key={accountKey(account)}
      account={account as IyzicoAccount | undefined}
      keyConfigured={keyConfigured}
    />
  ),
}

/** Settings > Payment > one provider: its state by the title, its settings below. */
export function PaymentProviderPage() {
  const { t } = useTranslation()
  const { provider } = route.useParams()
  const query = useQuery(providerAccountsQuery())
  // Bank transfer has no account: the shop's own settings (adr/0029)
  if (provider === "bank_transfer") {
    return <BankTransferPage />
  }
  if (provider === "cash_on_delivery") {
    return <CashOnDeliveryPage />
  }
  // The route lets only these through; the check narrows the id
  if (!isAccountMethod(provider)) {
    return null
  }
  const Settings = PROVIDER_SETTINGS[provider]
  const name = t(`settings.payments.methods.${provider}.name`)
  const account = query.data?.accounts.find((each) => each.provider === provider)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/settings/payments", label: t("settings.payments.title") }}
        title={name}
        description={t(`settings.payments.methods.${provider}.description`)}
        badge={query.data ? <AccountBadges account={account} name={name} /> : null}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={5} />
      ) : (
        <Settings account={account} keyConfigured={query.data.key_configured} />
      )}
    </div>
  )
}
