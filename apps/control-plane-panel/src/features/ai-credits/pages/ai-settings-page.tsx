import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { providersQuery, settingsQuery } from "@/features/ai-credits/api/queries"
import { ProvidersCard } from "@/features/ai-credits/components/providers-card"
import { RoutingCard } from "@/features/ai-credits/components/routing-card"
import { errorText } from "@/lib/errors"

/**
 * Ayarlar › Yapay zekâ sağlayıcıları (adr/0085 §5; the owner's alone):
 * the provider keys, the routing, the platform's limits and the top-up
 * packs. Each card saves its own part; a settings card reads the settings
 * again just before it saves (the last write wins on the server).
 */
export function AiSettingsPage() {
  const { t } = useTranslation()
  const settings = useQuery(settingsQuery())
  const providers = useQuery(providersQuery())
  const answer = settings.data
  // A card's draft starts again when the settings change underneath it (a key deleted unroutes)
  const version = answer?.settings.updated_at ?? "none"
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("aiCredits.settings.title")}
        description={
          answer?.settings.updated_at
            ? `${t("aiCredits.settings.text")} ${t("aiCredits.settings.updated", {
                day: formatDateTime(answer.settings.updated_at),
              })}`
            : t("aiCredits.settings.text")
        }
      />
      <ProvidersCard />
      {settings.isError ? (
        <ErrorState text={errorText(t, settings.error)} onRetry={() => void settings.refetch()} />
      ) : answer && providers.data ? (
        <RoutingCard key={version} answer={answer} providers={providers.data.providers} />
      ) : (
        <Skeleton className="h-64 rounded-lg" />
      )}
    </div>
  )
}
