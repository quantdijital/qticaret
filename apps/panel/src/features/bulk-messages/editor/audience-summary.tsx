import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { AudienceCount } from "@/features/bulk-messages/components/audience-count"
import { errorText } from "@/lib/errors"
import type { AudiencePreviewState } from "./use-audience-preview"

const A = "bulkMessages.audience.count"

/** The live count beside the editor, following the audience and channel on screen. */
export function AudienceSummary({ state }: { state: AudiencePreviewState }) {
  const { t } = useTranslation()
  const { query, empty, stale } = state
  return (
    <SectionCard title={t(`${A}.title`)}>
      {empty ? (
        <p className="text-sm text-muted-foreground">{t(`${A}.pick`)}</p>
      ) : query.isError && !query.data ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <AudienceCount preview={query.data} stale={stale} />
      )}
    </SectionCard>
  )
}
