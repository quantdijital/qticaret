import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Gauge } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Alert, AlertAction, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { useCan } from "@/features/auth/api/staff"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import { AiReviewsCard } from "@/features/settings/components/ai-reviews-card"
import { AiServiceCard } from "@/features/settings/components/ai-service-card"
import { AiUsageCard } from "@/features/settings/components/ai-usage-card"
import { errorText } from "@/lib/errors"

/**
 * Settings > Yapay zekâ (adr/0071 §13): a card for each AI service the
 * shop can connect with its own key, the switch for AI on reviews and
 * questions (Aşama 9), and this month's use under them.
 * Nothing else is set here: which service does which work is the
 * server's, the choice is made where the work is.
 */
export function AiPage() {
  const { t } = useTranslation()
  const services = useQuery(aiServicesQuery())
  // Whether the server can seal a key; one that may not read the accounts is not stopped by it
  const mayReadAccounts = useCan("accounts")
  const accounts = useQuery({ ...providerAccountsQuery(), enabled: mayReadAccounts })
  const data = services.data
  const ownKeys = data?.flags.own_keys ?? true

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("ai.title")} description={t("ai.description")} />
      {services.isError ? (
        <ErrorState text={errorText(t, services.error)} onRetry={() => void services.refetch()} />
      ) : !data ? (
        <LoadingRows />
      ) : (
        <>
          {ownKeys ? null : (
            <Alert role="status" className="border-warning/40 [&>svg]:text-warning-text">
              <Gauge aria-hidden="true" />
              <AlertDescription className="text-foreground">{t("ai.notInPlan")}</AlertDescription>
              <AlertAction>
                <Button asChild size="sm" variant="outline">
                  <Link to="/settings/subscription">{t("plan.view")}</Link>
                </Button>
              </AlertAction>
            </Alert>
          )}
          <div className="flex flex-col gap-4">
            {data.services.map((service) => (
              <AiServiceCard
                key={service.id}
                service={service}
                ownKeys={ownKeys}
                keyConfigured={accounts.data?.key_configured ?? true}
              />
            ))}
          </div>
          <AiReviewsCard />
          <AiUsageCard />
        </>
      )}
    </div>
  )
}
