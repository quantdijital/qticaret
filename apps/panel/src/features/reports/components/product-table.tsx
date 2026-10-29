import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SearchInput } from "@/components/patterns/search-input"
import { SectionCard } from "@/components/patterns/section-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { rankedProducts } from "@/features/reports/rank"
import type { ProductSort, ReportProduct } from "@/features/reports/rank"
import { ReportExportButton } from "@/features/reports/components/report-export"
import { formatCount, formatMoney, formatPercent } from "@/lib/format"

const SORTS: readonly ProductSort[] = ["sales", "units"]
// The server sends the period's best sellers up to this many
const REPORT_PRODUCTS = 100

/** A product's share of the period's sales: a bar and the figure. */
function ShareBar({ share }: { share: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${share * 100}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
        {formatPercent(share)}
      </span>
    </div>
  )
}

function ProductRow({ product, report }: { product: ReportProduct; report: DashboardOverview }) {
  const total = Number(report.totals.sales.current)
  const money = (amount: number | string) => formatMoney(amount, report.currency_code)
  return (
    <TableRow>
      <TableCell className="pl-5 text-xs text-muted-foreground tabular-nums">
        {product.rank}
      </TableCell>
      <TableCell>
        {/* A phone shows rank, product and sales; the name gives way */}
        <div className="flex max-w-[12rem] min-w-0 items-center gap-3 sm:max-w-none">
          <ProductThumb src={product.thumbnail} className="size-8" />
          <Link
            to="/products/$id"
            params={{ id: product.product_id }}
            className="truncate font-medium hover:underline"
          >
            {product.title}
          </Link>
        </div>
      </TableCell>
      <TableCell className="hidden text-right tabular-nums sm:table-cell">
        {formatCount(product.units)}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">
        {money(product.average)}
      </TableCell>
      <TableCell className="hidden w-56 lg:table-cell">
        <ShareBar share={total > 0 ? Number(product.sales) / total : 0} />
      </TableCell>
      <TableCell className="pr-5 text-right font-medium tabular-nums">
        {money(product.sales)}
      </TableCell>
    </TableRow>
  )
}

/** Every product sold in the period: searched by name, ordered by sales or units. */
export function ProductTable({ report }: { report: DashboardOverview }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<ProductSort>("sales")
  const rows = rankedProducts(report.top_products, sort, query)
  return (
    <SectionCard
      title={t("reports.products.title")}
      description={t("reports.products.hint")}
      flush
      action={
        report.top_products.length > 0 ? (
          <ReportExportButton format="csv" table="products" size="sm" />
        ) : null
      }
    >
      {report.top_products.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{t("dashboard.top.empty")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("reports.products.search")}
            />
            <ToggleGroup
              type="single"
              variant="outline"
              value={sort}
              aria-label={t("reports.products.sortBy")}
              onValueChange={(next) => {
                if (next) {
                  setSort(next as ProductSort)
                }
              }}
            >
              {SORTS.map((key) => (
                <ToggleGroupItem key={key} value={key} className="px-3 text-[13px]">
                  {t(`reports.products.by.${key}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {rows.length === 0 ? (
            <p className="border-t px-5 py-6 text-sm text-muted-foreground">
              {t("reports.products.noMatch")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-5">#</TableHead>
                  <TableHead>{t("reports.products.product")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    {t("reports.products.units")}
                  </TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    {t("reports.products.average")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("reports.products.share")}
                  </TableHead>
                  <TableHead className="pr-5 text-right">{t("reports.products.sales")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((product) => (
                  <ProductRow key={product.product_id} product={product} report={report} />
                ))}
              </TableBody>
            </Table>
          )}
          {report.top_products.length >= REPORT_PRODUCTS ? (
            <p className="border-t px-5 py-3 text-xs text-muted-foreground">
              {t("reports.products.capped", { total: REPORT_PRODUCTS })}
            </p>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}
