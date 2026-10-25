import type { UseQueryResult } from "@tanstack/react-query"
import { ImageOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import { formatCount, formatMoney } from "@/lib/format"

function Thumb({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
      <ImageOff className="size-4" aria-hidden="true" />
    </span>
  )
}

function ProductList({ overview }: { overview: DashboardOverview }) {
  const { t } = useTranslation()
  const products = overview.top_products
  if (products.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t("dashboard.top.empty")}</p>
  }
  const max = Math.max(...products.map((product) => Number(product.sales)))
  return (
    <ol className="flex flex-col gap-4">
      {products.map((product, index) => (
        <li key={product.product_id} className="flex items-center gap-3">
          <span className="tabular w-4 text-xs font-medium text-muted-foreground">{index + 1}</span>
          <Thumb src={product.thumbnail} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{product.title}</span>
              <span className="tabular shrink-0 text-sm font-medium">
                {formatMoney(product.sales, overview.currency_code)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{ width: `${String(max > 0 ? (Number(product.sales) / max) * 100 : 0)}%` }}
                />
              </div>
              <span className="tabular w-16 shrink-0 text-right text-xs text-muted-foreground">
                {t("dashboard.top.units", {
                  count: product.units,
                  formatted: formatCount(product.units),
                })}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The period's best sellers by sales, with units sold. */
export function TopProductsCard({
  query,
  className,
}: {
  query: UseQueryResult<DashboardOverview>
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={t("dashboard.top.title")}
      description={t("dashboard.top.description")}
      className={className}
    >
      <AsyncBody
        query={query}
        skeleton={
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        }
      >
        {(overview) => <ProductList overview={overview} />}
      </AsyncBody>
    </SectionCard>
  )
}
