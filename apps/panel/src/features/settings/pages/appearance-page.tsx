import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { AppearanceForm } from "@/features/settings/components/appearance-form"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { errorText } from "@/lib/errors"

/** Settings > Appearance (docs/18 §5): what the shop chooses, with a live preview. */
export function AppearancePage() {
  const { t } = useTranslation()
  const { data, isPending, isError, error, refetch } = useQuery(appearanceQuery())
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.appearance.title")}
        description={t("settings.appearance.subtitle")}
      />
      {isPending ? (
        <LoadingRows rows={5} />
      ) : isError ? (
        <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
      ) : (
        // A save brings a new version: the form starts again from it
        <AppearanceForm key={data.version} saved={data.values} />
      )}
    </div>
  )
}
