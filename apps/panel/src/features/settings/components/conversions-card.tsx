import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { CONVERSION_PROVIDERS } from "@/features/settings/conversion-providers"
import { errorText } from "@/lib/errors"

const C = "settings.marketing.conversions"

/**
 * Settings > Marketing: where purchases are told from the server (F10.9,
 * adr/0038 §4), each with its account page. An event goes only with the
 * consent the shopper gave in the storefront's cookie banner.
 */
export function ConversionsCard() {
  const { t } = useTranslation()
  const query = useQuery(providerAccountsQuery())
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)} flush>
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={2} />
      ) : (
        <ul>
          {CONVERSION_PROVIDERS.map((provider) => {
            const account = query.data.accounts.find(({ provider: id }) => id === provider.id)
            const name = t(`${C}.providers.${provider.id}.name`)
            const nameId = `conversion-provider-${provider.id}`
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
                    {t(`${C}.providers.${provider.id}.description`)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <AccountBadges account={account} name={name} />
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to="/settings/marketing/$provider"
                      params={{ provider: provider.id }}
                      aria-describedby={nameId}
                    >
                      {stored ? t(`${C}.manage`) : t(`${C}.connect`)}
                    </Link>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
