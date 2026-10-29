import { useQuery } from "@tanstack/react-query"
import { Hash, Lightbulb, Search, SearchX } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { searchReportQuery } from "@/features/reports/api/search"
import type { SearchReport, SearchTermRow } from "@/features/reports/api/search"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { useReportRange } from "@/features/reports/use-report"
import { formatCount, formatPercent } from "@/lib/format"

const S = "reports.search"
// Rows each list shows: the two cards stand side by side at the same height
const SHOWN = 15

function useSearchTiles(report: SearchReport | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const { totals } = report
  return [
    {
      key: "searches",
      icon: Search,
      label: t(`${S}.tiles.searches`),
      value: formatCount(totals.searches),
      hint: t(`${S}.tiles.searchesHint`),
    },
    {
      key: "zero",
      icon: SearchX,
      label: t(`${S}.tiles.zero`),
      value: formatCount(totals.zero_results),
      hint: t(`${S}.tiles.zeroHint`, {
        share: formatPercent(totals.searches === 0 ? 0 : totals.zero_results / totals.searches),
      }),
    },
    {
      key: "terms",
      icon: Hash,
      label: t(`${S}.tiles.terms`),
      value: formatCount(totals.terms),
      hint: t(`${S}.tiles.termsHint`),
    },
    {
      key: "zeroTerms",
      icon: Lightbulb,
      label: t(`${S}.tiles.zeroTerms`),
      value: formatCount(totals.zero_terms),
      hint: t(`${S}.tiles.zeroTermsHint`),
    },
  ]
}

function TermTable({
  title,
  hint,
  rows,
  empty,
  zeroFirst,
}: {
  title: string
  hint: string
  rows: SearchTermRow[]
  empty: string
  zeroFirst?: boolean
}) {
  const { t } = useTranslation()
  return (
    <SectionCard title={title} description={hint} flush className="h-full">
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t(`${S}.term`)}</TableHead>
              <TableHead className="text-right">
                {t(zeroFirst ? `${S}.zeroCount` : `${S}.searchCount`)}
              </TableHead>
              <TableHead className="pr-5 text-right">
                {t(zeroFirst ? `${S}.searchCount` : `${S}.zeroCount`)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, SHOWN).map((row) => (
              <TableRow key={row.term}>
                <TableCell className="pl-5 font-medium">{row.term}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(zeroFirst ? row.zero_results : row.searches)}
                </TableCell>
                <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">
                  {formatCount(zeroFirst ? row.searches : row.zero_results)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

/**
 * Storefront searches (F11.8): what shoppers look for, and what they look
 * for and do not find (a product, a page or a focus keyword missing; the
 * SEO advisor's S-SEARCH-01 lists it too).
 */
export function SearchReportPage() {
  const { t } = useTranslation()
  const report = useQuery(searchReportQuery(useReportRange()))
  const data = report.data
  return (
    <>
      <ReportTiles label={t(`${S}.tiles.label`)} tiles={useSearchTiles(data)} />
      {!data ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : (
        <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
          <TermTable
            title={t(`${S}.top.title`)}
            hint={t(`${S}.top.hint`)}
            rows={data.top}
            empty={t(`${S}.empty`)}
          />
          <TermTable
            title={t(`${S}.zero.title`)}
            hint={t(`${S}.zero.hint`)}
            rows={data.zero}
            empty={t(`${S}.zero.empty`)}
            zeroFirst
          />
        </div>
      )}
    </>
  )
}
