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
import { formatCount, formatPercent } from "@qticaret/admin-ui/lib/format"
import { aiAcceptanceQuery } from "@/features/ai/api/ai"
import { errorText } from "@/lib/errors"

const A = "ai.acceptance"

/** The rate as a percent; a dash with nothing offered. */
const percentOf = (rate: number | null): string => (rate === null ? "–" : formatPercent(rate))

/**
 * How often each task's suggestions are used (adr/0074 §4 "Ölçüm"): the
 * last 30 days' suggestions offered, accepted and the rate, by task, in a
 * small table on Settings › Yapay zekâ; a change to the writing guidance
 * shows here. Owner and admin (`GET /admin/ai/acceptance`).
 */
export function AiAcceptanceCard() {
  const { t } = useTranslation()
  const query = useQuery(aiAcceptanceQuery())
  const data = query.data
  const rows = (data?.tasks ?? []).filter((row) => row.offered > 0)

  return (
    <SectionCard
      title={t(`${A}.title`, { days: data?.days ?? 30 })}
      action={<InfoTip name={t(`${A}.title`, { days: data?.days ?? 30 })} hint={t(`${A}.hint`)} />}
      flush
    >
      {query.isError ? (
        <div className="px-5 pb-5">
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : !data ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-16" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-4 text-[13px] text-muted-foreground">{t(`${A}.empty`)}</p>
      ) : (
        <Table className="table-fixed" aria-label={t(`${A}.title`, { days: data.days })}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t(`${A}.task`)}</TableHead>
              <TableHead className="w-24 text-right">{t(`${A}.offered`)}</TableHead>
              <TableHead className="w-24 text-right">{t(`${A}.accepted`)}</TableHead>
              <TableHead className="w-20 pr-5 text-right">{t(`${A}.rate`)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.task}>
                <TableHead
                  scope="row"
                  className="h-10 max-w-0 truncate pl-5 font-normal whitespace-nowrap"
                >
                  {t(`ai.tasks.${row.task}`, { defaultValue: row.task })}
                </TableHead>
                <TableCell className="text-right tabular-nums">
                  {formatCount(row.offered)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(row.accepted)}
                </TableCell>
                <TableCell className="pr-5 text-right tabular-nums">
                  {percentOf(row.rate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
