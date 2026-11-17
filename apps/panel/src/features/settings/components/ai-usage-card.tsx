import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { aiUsageQuery } from "@/features/ai/api/ai"
import type { AiCeiling, AiUsageLine } from "@/features/ai/api/ai"
import { formatEstimate } from "@/features/ai/format"
import { errorText } from "@/lib/errors"

const U = "ai.usage"

/** "12 / 500", or "12 · sınır yok" without a ceiling. */
function Ceiling({ label, ceiling }: { label: string; ceiling: AiCeiling }) {
  const { t } = useTranslation()
  const full = ceiling.limit !== null && ceiling.used >= ceiling.limit
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={full ? "font-medium text-destructive-text" : "font-medium"}>
        {ceiling.limit === null
          ? t(`${U}.unlimited`, { used: formatCount(ceiling.used) })
          : t(`${U}.ofLimit`, { used: formatCount(ceiling.used), max: formatCount(ceiling.limit) })}
      </dd>
    </div>
  )
}

/** A service's or a task's month: tries, how many worked, the estimated cost. */
function Lines({
  title,
  lines,
  nameOf,
}: {
  title: string
  lines: AiUsageLine[]
  nameOf: (id: string) => string
}) {
  const { t } = useTranslation()
  return (
    <table className="w-full text-sm">
      <caption className="pb-1.5 text-left text-[13px] font-medium">{title}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{t(`${U}.name`)}</th>
          <th scope="col">{t(`${U}.count`)}</th>
          <th scope="col">{t(`${U}.cost`)}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-t">
            <th scope="row" className="py-2 pr-3 text-left font-normal">
              {nameOf(line.id)}
            </th>
            <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
              {t(`${U}.tries`, { count: line.count })}
              {line.failed + line.refused > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  {t(`${U}.notUsed`, { count: line.failed + line.refused })}
                </span>
              ) : null}
            </td>
            <td className="py-2 text-right whitespace-nowrap tabular-nums">
              {formatEstimate(line.estimated_cost_micros)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * This month's AI use on Settings > Yapay zekâ (adr/0071 §11, §13): by
 * service and by task, what it may have cost at the service (an estimate
 * from the list prices, not an invoice), and the package's monthly and
 * today's ceilings. Owner and admin (`GET /admin/ai/usage`).
 */
export function AiUsageCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const usage = useQuery(aiUsageQuery())
  const data = usage.data
  const empty = data?.services.length === 0

  return (
    <SectionCard
      title={t(`${U}.title`)}
      description={t(`${U}.description`)}
      action={<InfoTip name={t(`${U}.title`)} hint={t(`${U}.estimateHint`)} className="shrink-0" />}
      className={className}
    >
      {usage.isError ? (
        <ErrorState text={errorText(t, usage.error)} onRetry={() => void usage.refetch()} />
      ) : !data ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {empty ? (
              <p className="text-[13px] text-muted-foreground">{t(`${U}.empty`)}</p>
            ) : (
              <>
                <Lines
                  title={t(`${U}.byService`)}
                  lines={data.services}
                  nameOf={(id) => t(`ai.services.${id}.name`, { defaultValue: id })}
                />
                <Lines
                  title={t(`${U}.byTask`)}
                  lines={data.tasks}
                  nameOf={(id) => t(`ai.tasks.${id}`, { defaultValue: id })}
                />
              </>
            )}
            <p className="text-xs text-muted-foreground">{t(`${U}.estimateNote`)}</p>
          </div>
          <div className="flex flex-col gap-2 self-start rounded-md border bg-muted/40 px-3 py-3">
            <dl className="flex flex-col gap-2">
              <Ceiling label={t(`${U}.monthly`)} ceiling={data.monthly} />
              <Ceiling label={t(`${U}.daily.text`)} ceiling={data.daily.text} />
            </dl>
            <p className="text-xs text-muted-foreground">{t(`${U}.ceilingNote`)}</p>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
