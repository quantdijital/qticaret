import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { providersQuery, settingsQuery } from "@/features/ai-credits/api/queries"
import { ProvidersCard } from "@/features/ai-credits/components/providers-card"
import { GeneralCard } from "@/features/ai-credits/components/general-card"
import { PacksCard } from "@/features/ai-credits/components/packs-card"
import { RoutingCard } from "@/features/ai-credits/components/routing-card"
import { errorText } from "@/lib/errors"

/**
 * Ayarlar › Yapay zekâ sağlayıcıları (adr/0085 §5; the owner's alone):
 * the provider keys, the routing, the platform's limits and the top-up
 * packs. Each card saves its own part; a settings card reads the settings
 * again just before it saves (the last write wins on the server) and
 * stops if its own part changed under its draft (`useSettingsDraft`).
 */
export function AiSettingsPage() {
  const { t } = useTranslation()
  const settings = useQuery(settingsQuery())
  const providers = useQuery(providersQuery())
  const answer = settings.data
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
      {/* Once read, the cards stay (a failed read again keeps them and their drafts) */}
      {answer && providers.data ? (
        <>
          <RoutingCard answer={answer} providers={providers.data.providers} />
          <PageGrid>
            <PageColumn span={5}>
              <GeneralCard settings={answer.settings} />
            </PageColumn>
            <PageColumn span={7}>
              <PacksCard settings={answer.settings} />
            </PageColumn>
          </PageGrid>
        </>
      ) : settings.isError ? (
        <ErrorState text={errorText(t, settings.error)} onRetry={() => void settings.refetch()} />
      ) : (
        <Skeleton className="h-64 rounded-lg" />
      )}
    </div>
  )
}
