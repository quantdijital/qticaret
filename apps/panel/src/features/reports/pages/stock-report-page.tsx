import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Boxes, CircleDollarSign, Hourglass, PackageX } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@/components/patterns/states"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { stockReportQuery } from "@/features/reports/api/stock"
import type { StockReport, StockRow } from "@/features/reports/api/stock"
import { ReportExportButton } from "@/features/reports/components/report-export"
import type { ReportTable } from "@/features/reports/components/report-export"
import { ReportTiles } from "@/features/reports/components/report-tiles"
import type { ReportTile } from "@/features/reports/components/report-tiles"
import { useReportRange } from "@/features/reports/use-report"
import { formatCount, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { errorText } from "@/lib/errors"

const S = "reports.stock"
// Rows a list shows; the files have every item
const SHOWN = 20

const turnoverText = (value: number | null) =>
  value === null
    ? "—"
    : `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value)}×`

function useStockTiles(report: StockReport | undefined): ReportTile[] | null {
  const { t } = useTranslation()
  if (!report) {
    return null
  }
  const { totals } = report
  const money = (amount: string) => formatMoney(amount, report.currency_code)
  return [
    {
      key: "value",
      icon: CircleDollarSign,
      label: t(`${S}.tiles.value`),
      value: money(totals.value),
      hint: t(`${S}.tiles.valueHint`, { count: totals.costed_items }),
    },
    {
      key: "units",
      icon: Boxes,
      label: t(`${S}.tiles.units`),
      value: formatCount(totals.units),
      hint: t(`${S}.tiles.unitsHint`),
    },
    {
      key: "uncosted",
      icon: PackageX,
      label: t(`${S}.tiles.uncosted`),
      value: formatCount(totals.uncosted_items),
      hint: t(`${S}.tiles.uncostedHint`, { count: totals.uncosted_units }),
    },
    {
      key: "idle",
      icon: Hourglass,
      label: t(`${S}.tiles.idle`),
      value: formatCount(totals.idle_items),
      hint: t(`${S}.tiles.idleHint`, { days: report.idle_days, value: money(totals.idle_value) }),
    },
  ]
}

/** The product and variant, to the product page where its cost and stock are entered. */
function ItemName({ row }: { row: StockRow }) {
  const title = row.product_title ?? row.sku ?? "—"
  return (
    <span className="flex min-w-0 flex-col">
      {row.product_id ? (
        <Link
          to="/products/$id"
          params={{ id: row.product_id }}
          className="truncate font-medium hover:underline"
        >
          {title}
        </Link>
      ) : (
        <span className="truncate font-medium">{title}</span>
      )}
      <span className="truncate text-xs text-muted-foreground">
        {[row.variant_title, row.sku].filter(Boolean).join(" · ") || "—"}
      </span>
    </span>
  )
}

const VIEWS = ["value", "slow", "idle", "uncosted"] as const
type View = (typeof VIEWS)[number]

// The file each list has as CSV; the slowest come from the whole stock table
const TABLES: Record<View, ReportTable> = {
  value: "stock",
  slow: "stock",
  idle: "idle",
  uncosted: "uncosted",
}

interface Column {
  label: string
  cell: (row: StockRow) => ReactNode
  /** Shown on a phone too; the others from `sm` up. */
  always?: boolean
}

/**
 * Stock's four lists in one card (no side-by-side cards of unequal
 * length): the most valuable, the slowest turning, idle, without a cost.
 * Each shows its first SHOWN rows; the files have every item.
 */
function StockLists({ data }: { data: StockReport }) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>("value")
  const money = (amount: string | null) =>
    amount === null ? "—" : formatMoney(amount, data.currency_code)
  const units: Column = { label: t(`${S}.onHand`), cell: (row) => formatCount(row.on_hand) }
  const sold: Column = { label: t(`${S}.sold`), cell: (row) => formatCount(row.sold) }
  const cost: Column = { label: t(`${S}.cost`), cell: (row) => money(row.cost) }
  const worth: Column = { label: t(`${S}.worth`), cell: (row) => money(row.value), always: true }
  const lists: Record<View, { rows: StockRow[]; columns: Column[]; count?: number }> = {
    value: { rows: data.value, columns: [units, cost, worth] },
    slow: {
      rows: data.slow,
      columns: [
        units,
        sold,
        { label: t(`${S}.turnover`), cell: (row) => turnoverText(row.turnover), always: true },
      ],
    },
    idle: { rows: data.idle, columns: [units, cost, worth], count: data.totals.idle_items },
    uncosted: {
      rows: data.uncosted,
      columns: [sold, { ...units, always: true }],
      count: data.totals.uncosted_items,
    },
  }
  const { rows, columns } = lists[view]
  const days = { days: data.idle_days }
  return (
    <SectionCard
      title={t(`${S}.${view}.title`, days)}
      description={t(`${S}.${view}.hint`, days)}
      flush
      action={
        rows.length > 0 ? (
          <ReportExportButton report="stock" format="csv" table={TABLES[view]} size="sm" />
        ) : null
      }
    >
      <div className="px-5 pb-4">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          // Apart, so they wrap on a phone instead of running off the card
          spacing={1.5}
          className="flex-wrap"
          value={view}
          aria-label={t(`${S}.lists`)}
          onValueChange={(next) => {
            if (next) {
              setView(next as View)
            }
          }}
        >
          {VIEWS.map((key) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="gap-1.5 px-3 text-xs whitespace-nowrap data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              {t(`${S}.views.${key}`)}
              {lists[key].count === undefined ? null : (
                <span className="text-muted-foreground tabular-nums">
                  {formatCount(lists[key].count ?? 0)}
                </span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {rows.length === 0 ? (
        <p className="border-t px-5 py-4 text-sm text-muted-foreground">
          {t(`${S}.${view}.empty`)}
        </p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t(`${S}.item`)}</TableHead>
              {columns.map((column, index) => (
                <TableHead
                  key={column.label}
                  className={cn(
                    "w-28 text-right",
                    index === columns.length - 1 && "pr-5",
                    !column.always && "hidden sm:table-cell"
                  )}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, SHOWN).map((row) => (
              <TableRow key={row.item_id}>
                <TableCell className="pl-5">
                  <ItemName row={row} />
                </TableCell>
                {columns.map((column, index) => (
                  <TableCell
                    key={column.label}
                    className={cn(
                      "text-right tabular-nums",
                      index === columns.length - 1 && "pr-5",
                      !column.always && "hidden sm:table-cell"
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {rows.length > SHOWN ? (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          {t(`${S}.more`, { shown: SHOWN })}
        </p>
      ) : null}
    </SectionCard>
  )
}

/**
 * Stock (F11.4): its value at unit cost, the slowest turning items, idle
 * stock and what is on the shelf without a cost. The lists show their
 * first rows; the CSV and the Excel file have every item.
 */
export function StockReportPage() {
  const { t } = useTranslation()
  const report = useQuery(stockReportQuery(useReportRange()))
  const data = report.data
  const tiles = useStockTiles(data)
  if (report.isError) {
    return <ErrorState text={errorText(t, report.error)} onRetry={() => void report.refetch()} />
  }
  return (
    <>
      <ReportTiles label={t(`${S}.tiles.label`)} tiles={tiles} />
      {data ? <StockLists data={data} /> : <Skeleton className="h-96 rounded-lg" />}
    </>
  )
}
