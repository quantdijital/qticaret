import { useQuery } from "@tanstack/react-query"
import { CircleAlert, Clock, ShieldCheck, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { KpiTile } from "@/components/patterns/kpi-tile"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { iysSummaryQuery } from "@/features/settings/api/iys"
import { formatCount } from "@/lib/format"
import { errorText } from "@/lib/errors"

const C = "settings.sms.iysCard"

/**
 * Settings > SMS: how the customers' commercial consents are reaching
 * İYS through the shop's Netgsm account (F10 M11, adr/0038 §2). Without
 * the brand code they wait.
 */
export function IysCard() {
  const { t } = useTranslation()
  const summary = useQuery(iysSummaryQuery())
  const iys = summary.data?.iys
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      {summary.isError ? (
        <ErrorState text={errorText(t, summary.error)} onRetry={() => void summary.refetch()} />
      ) : !iys ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="flex flex-col gap-4">
          {iys.brand_code_set ? null : (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t(`${C}.noBrandCode`)}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <KpiTile
              icon={Clock}
              label={t(`${C}.pending`)}
              value={formatCount(iys.pending)}
              className="justify-between px-0 py-0"
            />
            <KpiTile
              icon={ShieldCheck}
              label={t(`${C}.sent`)}
              value={formatCount(iys.sent)}
              className="justify-between px-0 py-0"
            />
            <KpiTile
              icon={TriangleAlert}
              label={t(`${C}.failed`)}
              value={formatCount(iys.failed)}
              className="justify-between px-0 py-0"
            />
          </div>
        </div>
      )}
    </SectionCard>
  )
}
