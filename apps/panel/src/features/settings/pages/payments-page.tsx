import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import { PaytrCard } from "@/features/settings/components/paytr-card"
import { PaytrSetupCard } from "@/features/settings/components/paytr-setup-card"
import { paytrCardKey } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

/**
 * Settings > Payment (F5, adr/0027): the shop connects its own PayTR
 * account here; nothing waits on the platform team or a restart.
 * Installments come with V6, iyzico with V8.
 */
export function PaymentsPage() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  const paytr = query.data?.accounts.find(({ provider }) => provider === "paytr")
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.payments.title")}
        description={t("settings.payments.subtitle")}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={5} />
      ) : (
        <PageGrid>
          <PageColumn span={12}>
            <PaytrCard
              key={paytrCardKey(paytr)}
              account={paytr}
              keyConfigured={query.data.key_configured}
            />
            <PaytrSetupCard />
          </PageColumn>
        </PageGrid>
      )}
    </div>
  )
}
