import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { PackageOpen, Plus, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import type { BulkAction } from "@/features/products/api/bulk"
import { PAGE_SIZE, productCountsQuery, productsQuery } from "@/features/products/api/products"
import { BulkBar } from "@/features/products/bulk/bulk-bar"
import { BulkEditDialog } from "@/features/products/bulk/bulk-edit-dialog"
import { useProductColumns } from "@/features/products/components/product-columns"
import { SheetExportMenu } from "@/features/products/components/sheet-export-menu"
import { SheetImportDialog } from "@/features/products/components/sheet-import-dialog"
import { productScoresQuery } from "@/features/seo/api/advisor"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/products/")

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
  const columns = useProductColumns(
    new Map((scores.data ?? []).map((score) => [score.entity_id, score]))
  )
  const [importing, setImporting] = useState(false)
  // Picks stay across pages and searches until a bulk change is made or they are let go
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
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
          <div className="flex flex-wrap items-center gap-2">
            <SheetExportMenu />
            <Button
              variant="outline"
              onClick={() => {
                setImporting(true)
              }}
            >
              <Upload />
              {t("products.sheets.import")}
            </Button>
            <Button asChild>
              <Link to="/products/new">
                <Plus />
                {t("products.add")}
              </Link>
            </Button>
          </div>
        }
      />
      <SheetImportDialog open={importing} onOpenChange={setImporting} />
      <BulkEditDialog
        action={bulkAction}
        productIds={[...selected]}
        onClose={() => {
          setBulkAction(null)
        }}
        onDone={() => {
          setSelected(new Set())
        }}
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
        {selected.size > 0 ? (
          <BulkBar
            selected={selected}
            onSelect={setSelected}
            filters={{ q, status }}
            total={list.data?.count ?? 0}
            onAction={setBulkAction}
          />
        ) : null}
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
              selection={{
                selected,
                onChange: setSelected,
                rowLabel: (product) => product.title,
              }}
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
