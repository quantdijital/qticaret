import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { PackageOpen, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import { productScoresQuery } from "@/features/seo/api/advisor"
import type { StoredAssessment } from "@/features/seo/api/advisor"
import { GRADE_TEXT } from "@/features/seo/advisor/grades"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { PAGE_SIZE, productCountsQuery, productsQuery } from "@/features/products/api/products"
import type { ProductListItem } from "@/features/products/api/products"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { availableStock, priceRange } from "@/features/products/product-math"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { errorText } from "@/lib/errors"
import { formatCount, formatMoney, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const route = getRouteApi("/_auth/products/")
const CURRENCY = "try"
// docs/18: low stock reads amber from here down (adr/0020 brings per-item thresholds)
const LOW_STOCK = 5

function useColumns(scores: ReadonlyMap<string, StoredAssessment>): Column<ProductListItem>[] {
  const { t } = useTranslation()
  const prefix = useProductPathPrefix()
  return [
    {
      key: "product",
      header: t("products.columns.product"),
      cell: (product) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={product.thumbnail} />
          <div className="flex min-w-0 flex-col">
            <Link
              to="/products/$id"
              params={{ id: product.id }}
              className="truncate font-medium hover:underline"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              {product.title}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {prefix}
              {product.handle}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: t("products.columns.status"),
      cell: (product) => <ProductStatusBadge status={product.status} />,
    },
    {
      key: "stock",
      header: t("products.columns.stock"),
      className: "hidden md:table-cell",
      cell: (product) => {
        const stock = availableStock(product.variants)
        return stock === null ? (
          <span className="text-muted-foreground">{t("products.untracked")}</span>
        ) : (
          <span className={cn("tabular", stock <= LOW_STOCK && "font-medium text-warning-text")}>
            {t("products.inStock", { count: stock, formatted: formatCount(stock) })}
          </span>
        )
      },
    },
    {
      key: "variants",
      header: t("products.columns.variants"),
      className: "hidden lg:table-cell",
      cell: (product) => (
        <span className="tabular text-muted-foreground">
          {formatCount(product.variants?.length ?? 0)}
        </span>
      ),
    },
    {
      key: "category",
      header: t("products.columns.category"),
      className: "hidden xl:table-cell",
      cell: (product) => {
        const names = (product.categories ?? []).map((category) => category.name)
        return names.length ? (
          <span className="text-muted-foreground">
            {names[0]}
            {names.length > 1 ? ` +${String(names.length - 1)}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      key: "updated",
      header: t("products.columns.updated"),
      className: "hidden xl:table-cell",
      cell: (product) => (
        <span className="text-muted-foreground">{formatRelative(product.updated_at ?? "")}</span>
      ),
    },
    {
      key: "seo",
      header: t("seo.advisor.column"),
      align: "right",
      className: "hidden lg:table-cell",
      cell: (product) => {
        const score = scores.get(product.id)
        return score ? (
          <span
            className={cn("font-semibold tabular-nums", GRADE_TEXT[score.grade])}
            title={t(`seo.advisor.grades.${score.grade}`)}
          >
            {score.score}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      key: "price",
      header: t("products.columns.price"),
      align: "right",
      cell: (product) => {
        const range = priceRange(product.variants, CURRENCY)
        if (!range) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <span className="tabular font-medium">
            {formatMoney(range.min, CURRENCY)}
            {range.max > range.min ? ` – ${formatMoney(range.max, CURRENCY)}` : ""}
          </span>
        )
      },
    },
  ]
}

/** Every product with its picture, status, stock and price; search and quick views above. */
export function ProductsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const status = search.status ?? "all"
  const page = (search.page ?? 1) - 1
  const q = search.q ?? ""
  const list = useQuery(productsQuery({ q, status, page }))
  const counts = useQuery(productCountsQuery())
  const scores = useQuery(
    productScoresQuery((list.data?.products ?? []).map((product) => product.id))
  )
  const columns = useColumns(new Map((scores.data ?? []).map((score) => [score.entity_id, score])))
  const setSearch = (next: { q?: string; status?: typeof status; page?: number }) => {
    void navigate({
      to: "/products",
      search: {
        q: (next.q ?? q) || undefined,
        status: (next.status ?? status) === "all" ? undefined : (next.status ?? status),
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.products")}
        description={t("products.description")}
        action={
          <Button asChild>
            <Link to="/products/new">
              <Plus />
              {t("products.add")}
            </Link>
          </Button>
        }
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("products.views")}
          value={status}
          onChange={(next) => {
            setSearch({ status: next, page: 1 })
          }}
          tabs={[
            { key: "all", label: t("products.tabs.all"), count: counts.data?.all },
            {
              key: "published",
              label: t("products.tabs.published"),
              count: counts.data?.published,
            },
            { key: "draft", label: t("products.tabs.draft"), count: counts.data?.draft },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("products.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
        </div>
        {list.isError ? (
          <div className="px-5 pb-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.products}
              rowKey={(product) => product.id}
              loading={list.isPending}
              stale={list.isPlaceholderData}
              onRowClick={(product) => {
                void navigate({ to: "/products/$id", params: { id: product.id } })
              }}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <PackageOpen className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {q ? t("products.noMatch") : t("products.empty")}
                  </p>
                  {q ? null : (
                    <Button asChild size="sm">
                      <Link to="/products/new">
                        <Plus />
                        {t("products.add")}
                      </Link>
                    </Button>
                  )}
                </div>
              }
            />
            {list.data && list.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={list.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
