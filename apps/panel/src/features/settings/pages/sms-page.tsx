import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { IysCard } from "@/features/settings/components/iys-card"
import { SmsLimitCard } from "@/features/settings/components/sms-limit-card"
import { SmsOptOutCard } from "@/features/settings/components/sms-opt-out-card"
import { SMS_PROVIDERS } from "@/features/settings/sms-providers"
import { errorText } from "@/lib/errors"

const S = "settings.sms"

/**
 * The SMS tab of Settings > Messages (the owner, 2026-10-31); before, Settings > SMS (F9.2, adr/0036): the SMS services the shop can send
 * with, each on its own page where the shop connects its account.
 */
export function SmsPanel() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm text-muted-foreground">{t(`${S}.subtitle`)}</p>
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={2} />
      ) : (
        <SectionCard
          title={t(`${S}.providersTitle`)}
          description={t(`${S}.providersDescription`)}
          flush
        >
          <ul>
            {SMS_PROVIDERS.map((provider) => {
              const account = query.data.accounts.find(({ provider: id }) => id === provider.id)
              const name = t(`${S}.providers.${provider.id}.name`)
              const nameId = `sms-provider-${provider.id}`
              const stored = account !== undefined && account.state !== "not_configured"
              return (
                <li
                  key={provider.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-5 py-4"
                >
                  <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
                    <span id={nameId} className="text-sm font-medium">
                      {name}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {t(`${S}.providers.${provider.id}.description`)}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <AccountBadges account={account} name={name} />
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/settings/sms/$provider"
                        params={{ provider: provider.id }}
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
      <SmsLimitCard />
      <SmsOptOutCard />
      <IysCard />
    </div>
  )
}
