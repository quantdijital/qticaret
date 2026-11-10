import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { bulkMessageQuery } from "@/features/bulk-messages/api/bulk-messages"
import { BulkGate } from "@/features/bulk-messages/components/bulk-gate"
import { useBulkAccess } from "@/features/bulk-messages/components/use-bulk-access"
import { BulkEditor } from "@/features/bulk-messages/editor/bulk-editor"
import { BulkReportView } from "@/features/bulk-messages/report/report-view"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/bulk-messages/$id")

/** One campaign: its editor while a draft, its report after (adr/0050 §10). */
export function BulkMessagePage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const gate = useBulkAccess()
  const campaign = useQuery({ ...bulkMessageQuery(id), enabled: gate.access === "ok" })
  if (gate.access !== "ok") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          back={{ to: "/bulk-messages", label: t("bulkMessages.title") }}
          title={t("bulkMessages.title")}
        />
        <BulkGate gate={gate}>{null}</BulkGate>
      </div>
    )
  }
  if (campaign.isError) {
    return (
      <ErrorState text={errorText(t, campaign.error)} onRetry={() => void campaign.refetch()} />
    )
  }
  if (!campaign.data) {
    return <LoadingRows rows={8} />
  }
  // A copy opens its own editor, with its own values
  return campaign.data.editable ? (
    <BulkEditor key={campaign.data.id} campaign={campaign.data} />
  ) : (
    <BulkReportView key={campaign.data.id} campaign={campaign.data} />
  )
}
