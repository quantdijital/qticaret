import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Plus, Tag } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { BRAND_PAGE_SIZE, brandsQuery } from "@/features/brands/api/brands"
import type { Brand } from "@/features/brands/api/brands"
import { BrandLogo } from "@/features/brands/components/brand-logo"
import { NewBrandDialog } from "@/features/brands/components/new-brand-dialog"
import { useBrandPathPrefix } from "@/features/brands/use-brand-path"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

const route = getRouteApi("/_auth/brands/")

function useColumns(): Column<Brand>[] {
  const { t } = useTranslation()
  const prefix = useBrandPathPrefix()
  return [
    {
      key: "brand",
      header: t("brands.columns.brand"),
      cell: (brand) => (
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo url={brand.logo_url} name={brand.name} />
          <div className="flex min-w-0 flex-col">
            <Link
              to="/brands/$id"
              params={{ id: brand.id }}
              className="truncate font-medium hover:underline"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              {brand.name}
            </Link>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {prefix}
              {brand.handle}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "products",
      header: t("brands.columns.products"),
      align: "right",
      cell: (brand) => <span className="tabular-nums">{formatCount(brand.product_count)}</span>,
    },
    {
      key: "status",
      header: t("brands.columns.status"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (brand) => (
        <StatusBadge tone={brand.is_active ? "success" : "neutral"}>
          {t(brand.is_active ? "brands.active" : "brands.inactive")}
        </StatusBadge>
      ),
    },
  ]
}

/** Brands (F3.11, docs/06): each with its page, logo and products. */
export function BrandsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const list = useQuery(brandsQuery({ q, page }))
  const columns = useColumns()
  const [adding, setAdding] = useState(false)
  const setSearch = (next: { q?: string; page?: number }) => {
    void navigate({
      to: "/brands",
      search: (previous: { q?: string | undefined; page?: number | undefined }) => {
        const merged = { ...previous, ...next }
        return {
          q: merged.q === "" ? undefined : merged.q,
          page: merged.page && merged.page > 1 ? merged.page : undefined,
        }
      },
      replace: true,
    })
  }
  const add = (
    <Button
      onClick={() => {
        setAdding(true)
      }}
    >
      <Plus />
      {t("brands.add")}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.brands")} description={t("brands.description")} action={add} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("brands.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
        </div>
        {list.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={list.data?.brands}
            rowKey={(brand) => brand.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            onRowClick={(brand) => {
              void navigate({ to: "/brands/$id", params: { id: brand.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <Tag className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  {q ? t("brands.noMatch") : t("brands.empty")}
                </p>
                {q ? null : add}
              </div>
            }
          />
        )}
        {list.data && list.data.count > BRAND_PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={BRAND_PAGE_SIZE}
            count={list.data.count}
            onPageChange={(next) => {
              setSearch({ page: next + 1 })
            }}
          />
        ) : null}
      </section>
      <NewBrandDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
