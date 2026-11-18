import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qticaret/admin-ui/ui/table"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { aiUsageQuery } from "@/features/ai/api/ai"
import type { AiCeiling, AiUsageLine } from "@/features/ai/api/ai"
import { formatEstimate } from "@/features/ai/format"
import { errorText } from "@/lib/errors"

const U = "ai.usage"

/** "Aylık sınır 12 / 500", or "12 · sınır yok" without a ceiling; red once it is reached. */
function Ceiling({ label, ceiling }: { label: string; ceiling: AiCeiling }) {
  const { t } = useTranslation()
  const full = ceiling.limit !== null && ceiling.used >= ceiling.limit
  return (
    <div className="flex items-baseline gap-1.5 text-[13px] whitespace-nowrap">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium tabular-nums", full ? "text-destructive-text" : "")}>
        {ceiling.limit === null
          ? t(`${U}.unlimited`, { used: formatCount(ceiling.used) })
          : t(`${U}.ofLimit`, { used: formatCount(ceiling.used), max: formatCount(ceiling.limit) })}
      </dd>
    </div>
  )
}

/** A group's rows (by service, by task) under its own heading row. */
function Group({
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
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableHead scope="colgroup" colSpan={3} className="h-8 pl-5 text-xs text-muted-foreground">
          {title}
        </TableHead>
      </TableRow>
      {lines.map((line) => (
        <TableRow key={line.id}>
          <TableHead
            scope="row"
            className="h-10 max-w-0 truncate pl-5 font-normal whitespace-nowrap"
          >
            {nameOf(line.id)}
          </TableHead>
          <TableCell className="text-right whitespace-normal tabular-nums">
            {t(`${U}.tries`, { count: line.count })}
            {line.failed + line.refused > 0 ? (
              // Beside the count when it fits, under it on a phone
              <span className="block text-xs text-muted-foreground sm:inline sm:before:content-['_·_']">
                {t(`${U}.notUsed`, { count: line.failed + line.refused })}
              </span>
            ) : null}
          </TableCell>
          <TableCell className="pr-5 text-right tabular-nums">
            {formatEstimate(line.estimated_cost_micros)}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

/**
 * This month's AI use on Settings > Yapay zekâ (adr/0071 §11, §13): a
 * small table by service and by task with what it may have cost at the
 * service (an estimate from the list prices, not an invoice), and the
 * package's monthly and today's ceilings beside the title; what the
 * estimate and the ceilings mean behind (i). Owner and admin
 * (`GET /admin/ai/usage`).
 */
export function AiUsageCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const usage = useQuery(aiUsageQuery())
  const data = usage.data
  const tip = (
    <span className="flex flex-col gap-1.5">
      <span>{t(`${U}.estimateHint`)}</span>
      <span>{t(`${U}.ceilingNote`)}</span>
    </span>
  )

  return (
    <SectionCard
      title={t(`${U}.title`)}
      action={
        <>
          {data ? (
            // A phone: one ceiling a line, so the pair never runs past the card
            <dl className="flex flex-col gap-y-0.5 sm:flex-row sm:items-baseline sm:gap-x-4">
              <Ceiling label={t(`${U}.monthly`)} ceiling={data.monthly} />
              <Ceiling label={t(`${U}.daily.text`)} ceiling={data.daily.text} />
            </dl>
          ) : null}
          <InfoTip name={t(`${U}.title`)} hint={tip} />
        </>
      }
      className={className}
      flush
    >
      {usage.isError ? (
        <div className="px-5 pb-5">
          <ErrorState text={errorText(t, usage.error)} onRetry={() => void usage.refetch()} />
        </div>
      ) : !data ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-16" />
        </div>
      ) : data.services.length === 0 ? (
        <p className="px-5 pb-4 text-[13px] text-muted-foreground">{t(`${U}.empty`)}</p>
      ) : (
        <Table className="table-fixed" aria-label={t(`${U}.title`)}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t(`${U}.name`)}</TableHead>
              <TableHead className="w-32 text-right sm:w-56">{t(`${U}.count`)}</TableHead>
              <TableHead className="w-24 pr-5 text-right whitespace-normal sm:w-36">
                {t(`${U}.cost`)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Group
              title={t(`${U}.byService`)}
              lines={data.services}
              nameOf={(id) => t(`ai.services.${id}.name`, { defaultValue: id })}
            />
            <Group
              title={t(`${U}.byTask`)}
              lines={data.tasks}
              nameOf={(id) => t(`ai.tasks.${id}`, { defaultValue: id })}
            />
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
